(function () {
  "use strict";

  var STORAGE_KEY = "check-materias";
  var LEGACY_KEY = "check-materias-notas";
  var GRADES_KEY = "check-materias-avaliacoes-v2";
  var CUSTOM_KEY = "check-materias-adicionadas-v1";
  var HIDDEN_KEY = "check-materias-originais-excluidas-v1";
  var EDIT_KEY = "check-materias-originais-editadas-v1";
  var calculator = window.GradeCalculator;
  var list = document.getElementById("list");
  var rowTemplate = list.querySelector(".subject").cloneNode(true);
  var originalTemplates = Array.from(list.querySelectorAll(".subject"), function (subject) { return subject.cloneNode(true); });
  var rows = [];
  var pimInput = document.getElementById("pimInput");
  var pimError = document.getElementById("pimError");
  var views = [];
  var addSubjectBtn = document.getElementById("addSubjectBtn");
  var subjectForm = document.getElementById("subjectForm");
  var subjectName = document.getElementById("subjectName");
  var subjectTag = document.getElementById("subjectTag");
  var restoreSubjectsBtn = document.getElementById("restoreSubjectsBtn");
  var subjectFormSave = subjectForm.querySelector(".save-subject");
  var editingView = null;

  function load(key) {
    try {
      var value = JSON.parse(localStorage.getItem(key));
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch (error) { return {}; }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      var message = document.getElementById("storageMessage");
      message.textContent = "Não foi possível salvar os dados neste navegador.";
      message.hidden = false;
      return false;
    }
  }

  function textValue(value) {
    return typeof value === "string" || (typeof value === "number" && Number.isFinite(value)) ? String(value) : "";
  }

  var state = load(STORAGE_KEY);
  var legacy = load(LEGACY_KEY);
  var grades = load(GRADES_KEY);
  grades.pim = textValue(grades.pim);
  if (!grades.subjects || typeof grades.subjects !== "object" || Array.isArray(grades.subjects)) grades.subjects = {};

  var allowedTags = ["", "Presencial", "AVA", "DP", "optativa"];
  var originalEdits = load(EDIT_KEY);
  var existingIds = new Set(Array.from(list.querySelectorAll(".subject"), function (subject) {
    return subject.getAttribute("data-id");
  }));
  var hiddenOriginalIds = new Set();
  try {
    var savedHidden = JSON.parse(localStorage.getItem(HIDDEN_KEY));
    if (Array.isArray(savedHidden)) savedHidden.forEach(function (id) {
      if (typeof id === "string" && existingIds.has(id)) hiddenOriginalIds.add(id);
    });
  } catch (error) {}
  var customSubjects = [];
  try {
    var savedCustom = JSON.parse(localStorage.getItem(CUSTOM_KEY));
    if (Array.isArray(savedCustom)) {
      savedCustom.forEach(function (item) {
        if (!item || typeof item !== "object" || typeof item.id !== "string" ||
            !/^custom-[a-zA-Z0-9-]+$/.test(item.id) || existingIds.has(item.id) ||
            typeof item.name !== "string" || !item.name.trim() || item.name.trim().length > 100) return;
        var tag = allowedTags.indexOf(item.tag) >= 0 ? item.tag : "";
        customSubjects.push({ id: item.id, name: item.name.trim(), tag: tag });
        existingIds.add(item.id);
      });
    }
  } catch (error) {}

  function create(tag, className, text) {
    var node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function format(value) {
    return value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 3 });
  }

  function updateProgress() {
    var checkable = rows.filter(function (row) { return !row.disabled; });
    var done = checkable.filter(function (row) { return row.getAttribute("aria-checked") === "true"; }).length;
    document.getElementById("doneCount").textContent = done;
    document.getElementById("totalCount").textContent = checkable.length;
    document.getElementById("progressFill").style.width = (checkable.length ? done / checkable.length * 100 : 0) + "%";
    document.querySelector(".footer").setAttribute("data-complete", checkable.length && done === checkable.length ? "true" : "false");
  }

  function validate(input) {
    var parsed = calculator.parseValue(input.value);
    input.setCustomValidity(parsed.error || "");
    input.setAttribute("aria-invalid", parsed.error ? "true" : "false");
    return parsed.error;
  }

  function render(view) {
    var errors = [];
    ["np1", "np2"].forEach(function (key, index) {
      var error = validate(view.inputs[key]);
      if (error) errors.push("N" + (index + 1) + ": " + error);
    });
    if (view.inputs.exam) {
      var examError = validate(view.inputs.exam);
      if (examError) errors.push("Exame: " + examError);
    }
    view.error.textContent = errors.join(" ");
    view.error.hidden = errors.length === 0;

    var calculationInput = {
      np1: view.data.np1,
      np2: view.data.np2,
      pim: grades.pim,
      tag: view.tag
    };
    calculationInput.usesPim = calculator.shouldUsePim(calculationInput);
    var isDP = !calculationInput.usesPim;
    if (isDP) {
      calculationInput.exam = view.data.exam;
    }
    var result = calculator.calculate(calculationInput);
    var total = result.semesterOfficial;
    var provisional = calculationInput.usesPim && total === null
      && result.provisionalSemester !== null && result.provisionalSemester !== undefined;
    var pimEmpty = calculationInput.usesPim && calculator.parseValue(grades.pim).value === null;
    var formula = !calculationInput.usesPim
      ? "Média = (N1 + N2) ÷ 2. "
      : pimEmpty
        ? "Média provisória = (N1 + N2) ÷ 2. Definitiva = (N1 × 4 + N2 × 4 + PIM × 2) ÷ 10. "
        : "Média = (N1 × 4 + N2 × 4 + PIM × 2) ÷ 10. ";
    if (isDP && result.final !== null) {
      view.total.textContent = format(result.finalOfficial);
      view.total.setAttribute("data-pending", "false");
      view.total.setAttribute("data-pass", result.finalOfficial >= 5 ? "true" : "false");
      view.total.title = "Média semestral: " + format(result.semester) + ". "
        + "Média final = (MS + Exame) ÷ 2 = " + format(result.final)
        + (result.finalOfficial !== result.final ? "; arredondada para 5,0." : ".");
    } else if (provisional) {
      view.total.textContent = format(result.provisionalSemester);
      view.total.setAttribute("data-pending", "false");
      view.total.removeAttribute("data-pass");
      view.total.title = "Média provisória = (N1 + N2) ÷ 2 = " + format(result.provisionalSemester)
        + ". Preencha o PIM para o cálculo definitivo.";
    } else if (total === null) {
      view.total.textContent = "Pendente";
      view.total.setAttribute("data-pending", "true");
      view.total.removeAttribute("data-pass");
      view.total.title = calculationInput.usesPim
        ? "Preencha N1, N2 e PIM com notas válidas de 0 a 10."
        : "Matéria DP: preencha N1 e N2 com notas de 0 a 10. Média = (N1 + N2) ÷ 2, sem PIM.";
    } else {
      view.total.textContent = format(total);
      view.total.setAttribute("data-pending", "false");
      view.total.setAttribute("data-pass", result.semester >= 6.7 ? "true" : "false");
      view.total.title = formula
        + (total !== result.semester
          ? "Média calculada: " + format(result.semester) + "; arredondada para 7,0."
          : "Média calculada: " + format(result.semester) + ".");
    }

    if (view.examWrap) {
      view.examWrap.hidden = !(isDP && result.examRequired === true);
    }

    if (isDP && result.final !== null) {
      if (result.finalOfficial >= 5) {
        view.required.setAttribute("data-state", "achieved");
        view.requiredLabel.textContent = "Resultado";
        view.required.textContent = result.finalOfficial !== result.final ? "Aprovado (arred.)" : "Aprovado";
        view.required.title = "Média final: " + format(result.finalOfficial) + ". Aprovado após exame.";
      } else {
        view.required.setAttribute("data-state", "impossible");
        view.requiredLabel.textContent = "Resultado";
        view.required.textContent = "Reprovado";
        view.required.title = "Média final: " + format(result.final) + ". Reprovado por nota.";
      }
    } else {
      var required = calculator.getRequiredGrade(calculationInput);
      var names = { np1: "N1", np2: "N2", pim: "PIM", exam: "EX" };
      view.required.setAttribute("data-state", required.state);
      view.requiredLabel.textContent = required.field === "exam" ? "Exame" : "Para passar";
      if (required.state === "pending") {
        view.required.textContent = "Pendente";
        view.required.title = calculationInput.usesPim
          ? "Confira as notas de N1, N2 e PIM; use valores de 0 a 10."
          : "Informe uma nota válida em N1 ou N2 para calcular quanto falta na outra.";
      } else if (required.state === "achieved") {
        view.required.textContent = "Atingida";
        view.required.title = "A média para aprovação direta já foi atingida. A aprovação também exige frequência de pelo menos 75%.";
      } else if (required.state === "impossible") {
        view.required.textContent = names[required.field] + " > 10";
        view.required.title = "Seriam necessários " + format(required.value) + " na " + names[required.field]
          + ". Não é possível atingir a média direta só com essa nota. Lance a nota restante para calcular o exame.";
      } else {
        var needed = required.value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        view.required.textContent = required.field === "exam" ? needed : names[required.field] + ": " + needed;
        view.required.title = required.field === "exam"
          ? "Exame: mínimo de " + needed + " para média final de pelo menos 4,75, arredondada para 5,0. Exige frequência mínima de 75%."
          : pimEmpty && (required.field === "np1" || required.field === "np2")
            ? "Mínimo de " + needed + " em " + names[required.field] + " para alcançar média 7,0 (sem considerar o PIM)."
            : "Mínimo de " + needed + " em " + names[required.field] + " para atingir média de 6,70, arredondada para 7,0.";
      }
      view.required.title += " " + formula;
    }
  }

  function renderAll() {
    pimError.textContent = validate(pimInput) || "";
    pimError.hidden = !pimError.textContent;
    views.forEach(render);
  }

  function addInput(view, key, label) {
    var wrapper = create("div", "nota-field");
    var input = create("input", "nota");
    input.id = view.id + "-" + key;
    input.type = "text";
    input.inputMode = "decimal";
    input.autocomplete = "off";
    input.placeholder = "—";
    input.value = view.data[key];
    input.setAttribute("aria-label", label + " — " + view.name);
    input.setAttribute("aria-describedby", view.error.id);
    var caption = create("label", "field-label", label);
    caption.htmlFor = input.id;
    wrapper.append(caption, input);
    view.inputs[key] = input;
    input.addEventListener("input", function () {
      view.data[key] = input.value;
      save(GRADES_KEY, grades);
      render(view);
    });
    return wrapper;
  }

  function buildCustomSubject(item) {
    var subject = rowTemplate.cloneNode(true);
    subject.setAttribute("data-id", item.id);
    subject.classList.add("custom-subject");
    setSubjectDetails(subject, item.name, item.tag);
    return subject;
  }

  function setSubjectDetails(subject, name, tag) {
    var nameNode = subject.querySelector(".name");
    nameNode.textContent = name;
    if (tag) {
      nameNode.appendChild(document.createTextNode(" "));
      nameNode.appendChild(create("span", "tag", tag));
    }
  }

  function refreshSubjectLabels(view) {
    view.name = view.subject.querySelector(".name").textContent;
    view.inputs.np1.setAttribute("aria-label", "N1 — " + view.name);
    view.inputs.np2.setAttribute("aria-label", "N2 — " + view.name);
    if (view.inputs.exam) view.inputs.exam.setAttribute("aria-label", "Exame — " + view.name);
    view.total.setAttribute("aria-label", "Média total — " + view.name);
    view.required.setAttribute("aria-label", "Nota necessária para aprovação — " + view.name);
    view.editButton.setAttribute("aria-label", "Editar matéria — " + view.name);
    view.removeButton.setAttribute("aria-label", "Excluir matéria — " + view.name);
  }

  function updateSubjectCheck(view) {
    var presencial = view.tag === "Presencial";
    var row = view.subject.querySelector(".row");
    view.subject.classList.toggle("presencial-subject", presencial);
    row.disabled = presencial;
    row.querySelector(".box").hidden = presencial;
    if (presencial) {
      row.removeAttribute("role");
      row.removeAttribute("aria-checked");
    } else {
      row.setAttribute("role", "checkbox");
      row.setAttribute("aria-checked", state[view.id] === true ? "true" : "false");
    }
    updateProgress();
  }

  function sortSubjects() {
    var order = { Presencial: 0, AVA: 1, optativa: 1, "": 2, DP: 3 };
    views.slice().sort(function (a, b) {
      return order[a.tag] - order[b.tag];
    }).forEach(function (view) {
      list.appendChild(view.subject);
    });
  }

  function updateRestoreButton() {
    restoreSubjectsBtn.hidden = hiddenOriginalIds.size === 0;
  }

  function removeSubject(subject, row, view) {
    if (editingView === view) setFormOpen(false);
    if (subject.classList.contains("custom-subject")) {
      var nextCustom = customSubjects.filter(function (item) { return item.id !== view.id; });
      if (!save(CUSTOM_KEY, nextCustom)) return;
      customSubjects = nextCustom;
      existingIds.delete(view.id);
    } else {
      var nextHidden = Array.from(hiddenOriginalIds);
      nextHidden.push(view.id);
      if (!save(HIDDEN_KEY, nextHidden)) return;
      hiddenOriginalIds.add(view.id);
      updateRestoreButton();
    }
    delete state[view.id];
    delete grades.subjects[view.id];
    delete legacy[view.id];
    save(STORAGE_KEY, state);
    save(GRADES_KEY, grades);
    save(LEGACY_KEY, legacy);
    rows.splice(rows.indexOf(row), 1);
    views.splice(views.indexOf(view), 1);
    subject.remove();
    document.getElementById("totalCount").textContent = rows.length;
    updateProgress();
    addSubjectBtn.focus();
  }

  function registerSubject(subject) {
    var row = subject.querySelector(".row");
    var id = subject.getAttribute("data-id");
    if (!subject.classList.contains("custom-subject")) {
      var savedEdit = originalEdits[id];
      if (savedEdit && typeof savedEdit.name === "string" && savedEdit.name.trim() &&
          savedEdit.name.trim().length <= 100 && allowedTags.indexOf(savedEdit.tag) >= 0) {
        setSubjectDetails(subject, savedEdit.name.trim(), savedEdit.tag);
      }
    }
    var nameNode = subject.querySelector(".name");
    var subjectNameText = nameNode.firstChild ? nameNode.firstChild.textContent.trim() : "";
    var subjectTagText = nameNode.querySelector(".tag") ? nameNode.querySelector(".tag").textContent : "";
    var saved = grades.subjects[id];
    var data = saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
    // O campo de nota original passa a ser N1, preservando o valor cadastrado.
    data.np1 = Object.prototype.hasOwnProperty.call(data, "np1") ? textValue(data.np1) : textValue(legacy[id]);
    data.np2 = textValue(data.np2);
    data.exam = textValue(data.exam);
    grades.subjects[id] = data;
    var view = { id: id, name: nameNode.textContent, subjectName: subjectNameText,
      tag: subjectTagText, subject: subject, data: data, inputs: {} };
    view.error = create("p", "subject-error");
    view.error.id = id + "-error";
    view.error.hidden = true;
    var wrap = create("div", "nota-wrap");
    wrap.append(addInput(view, "np1", "N1"), addInput(view, "np2", "N2"));
    view.examWrap = addInput(view, "exam", "Exame");
    view.examWrap.hidden = true;
    wrap.appendChild(view.examWrap);
    var totalField = create("div", "nota-field");
    view.total = create("output", "nota media-total", "Pendente");
    view.total.id = id + "-total";
    view.total.setAttribute("aria-label", "Média total — " + view.name);
    view.total.setAttribute("for", id + "-np1 " + id + "-np2 pimInput");
    var totalLabel = create("label", "field-label", "Média");
    totalLabel.htmlFor = view.total.id;
    totalField.append(totalLabel, view.total);
    wrap.appendChild(totalField);
    var requiredField = create("div", "nota-field");
    view.required = create("output", "nota nota-necessaria", "Pendente");
    view.required.id = id + "-required";
    view.required.setAttribute("aria-label", "Nota necessária para aprovação — " + view.name);
    view.required.setAttribute("for", id + "-np1 " + id + "-np2 pimInput");
    var requiredLabel = create("label", "field-label", "Para passar");
    requiredLabel.htmlFor = view.required.id;
    view.requiredLabel = requiredLabel;
    requiredField.append(requiredLabel, view.required);
    wrap.appendChild(requiredField);
    subject.append(wrap, view.error);
    views.push(view);
    rows.push(row);

    var removeButton = create("button", "remove-subject");
    var editButton = create("button", "edit-subject");
    editButton.type = "button";
    editButton.setAttribute("aria-label", "Editar matéria — " + view.name);
    editButton.title = "Editar nome e tag";
    editButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4ZM13 7l4 4M15 5l2-2 4 4-2 2"/></svg><span>Editar</span>';
    editButton.addEventListener("click", function () { setFormOpen(true, view); });
    view.editButton = editButton;
    removeButton.type = "button";
    removeButton.setAttribute("aria-label", "Excluir matéria — " + view.name);
    removeButton.title = "Excluir matéria e notas";
    removeButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4-6v6"/></svg><span>Excluir</span>';
    removeButton.addEventListener("click", function () {
      if (removeButton.getAttribute("data-confirm") !== "true") {
        removeButton.setAttribute("data-confirm", "true");
        removeButton.setAttribute("aria-label", "Confirmar exclusão de " + view.name + " e suas notas");
        removeButton.querySelector("span").textContent = "Confirmar exclusão";
        subject.classList.add("confirming-delete");
        return;
      }
      removeSubject(subject, row, view);
    });
    removeButton.addEventListener("blur", function () {
      removeButton.removeAttribute("data-confirm");
      removeButton.setAttribute("aria-label", "Excluir matéria — " + view.name);
      removeButton.querySelector("span").textContent = "Excluir";
      subject.classList.remove("confirming-delete");
    });
    view.removeButton = removeButton;
    subject.append(editButton, removeButton);

    row.addEventListener("click", function () {
      if (row.disabled) return;
      var checked = row.getAttribute("aria-checked") !== "true";
      row.setAttribute("aria-checked", checked ? "true" : "false");
      state[id] = checked;
      save(STORAGE_KEY, state);
      updateProgress();
    });
    render(view);
    updateSubjectCheck(view);
  }

  Array.from(list.querySelectorAll(".subject")).forEach(function (subject) {
    if (hiddenOriginalIds.has(subject.getAttribute("data-id"))) subject.remove();
  });
  updateRestoreButton();
  customSubjects.forEach(function (item) {
    list.appendChild(buildCustomSubject(item));
  });
  Array.from(list.querySelectorAll(".subject")).forEach(registerSubject);
  sortSubjects();
  pimInput.value = grades.pim;

  function setFormOpen(open, view) {
    editingView = open ? view || null : null;
    subjectForm.hidden = !open;
    addSubjectBtn.setAttribute("aria-expanded", open ? "true" : "false");
    subjectName.setCustomValidity("");
    subjectFormSave.textContent = editingView ? "Salvar alterações" : "Salvar matéria";
    if (open) {
      subjectName.value = editingView ? editingView.subjectName : "";
      subjectTag.value = editingView ? editingView.tag : "";
      subjectForm.scrollIntoView({ block: "nearest" });
      subjectName.focus();
      subjectName.select();
    } else {
      subjectForm.reset();
    }
  }

  addSubjectBtn.addEventListener("click", function () {
    setFormOpen(subjectForm.hidden);
  });
  document.getElementById("cancelSubjectBtn").addEventListener("click", function () {
    var previousEdit = editingView;
    setFormOpen(false);
    (previousEdit ? previousEdit.editButton : addSubjectBtn).focus();
  });
  restoreSubjectsBtn.addEventListener("click", function () {
    if (!save(HIDDEN_KEY, [])) return;
    hiddenOriginalIds.clear();
    originalTemplates.forEach(function (template, index) {
      var id = template.getAttribute("data-id");
      if (list.querySelector('.subject[data-id="' + id + '"]')) return;
      var next = null;
      for (var i = index + 1; i < originalTemplates.length; i++) {
        next = list.querySelector('.subject[data-id="' + originalTemplates[i].getAttribute("data-id") + '"]');
        if (next) break;
      }
      list.insertBefore(template.cloneNode(true), next || list.querySelector(".custom-subject"));
      registerSubject(list.querySelector('.subject[data-id="' + id + '"]'));
    });
    sortSubjects();
    updateRestoreButton();
  });
  subjectName.addEventListener("input", function () { subjectName.setCustomValidity(""); });
  subjectForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var name = subjectName.value.trim();
    if (!name) {
      subjectName.setCustomValidity("Informe o nome da matéria.");
      subjectName.reportValidity();
      return;
    }
    var tag = allowedTags.indexOf(subjectTag.value) >= 0 ? subjectTag.value : "";
    if (editingView) {
      var editedView = editingView;
      if (editedView.subject.classList.contains("custom-subject")) {
        var updatedCustom = customSubjects.map(function (item) {
          return item.id === editedView.id ? { id: item.id, name: name, tag: tag } : item;
        });
        if (!save(CUSTOM_KEY, updatedCustom)) return;
        customSubjects = updatedCustom;
      } else {
        var updatedOriginals = Object.assign({}, originalEdits);
        updatedOriginals[editedView.id] = { name: name, tag: tag };
        if (!save(EDIT_KEY, updatedOriginals)) return;
        originalEdits = updatedOriginals;
      }
      setSubjectDetails(editedView.subject, name, tag);
      editedView.subjectName = name;
      editedView.tag = tag;
      refreshSubjectLabels(editedView);
      render(editedView);
      updateSubjectCheck(editedView);
      sortSubjects();
      setFormOpen(false);
      editedView.editButton.focus();
      return;
    }
    var id;
    do {
      id = "custom-" + (window.crypto && window.crypto.randomUUID
        ? window.crypto.randomUUID()
        : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2));
    } while (existingIds.has(id));
    var item = { id: id, name: name, tag: tag };
    customSubjects.push(item);
    if (!save(CUSTOM_KEY, customSubjects)) {
      customSubjects.pop();
      return;
    }
    existingIds.add(id);
    var subject = buildCustomSubject(item);
    list.appendChild(subject);
    registerSubject(subject);
    sortSubjects();
    subjectForm.reset();
    setFormOpen(false);
    subject.querySelector(".row").focus();
  });

  pimInput.addEventListener("input", function () {
    grades.pim = pimInput.value;
    save(GRADES_KEY, grades);
    renderAll();
  });

  document.getElementById("resetBtn").addEventListener("click", function () {
    state = {};
    legacy = {};
    grades.pim = "";
    pimInput.value = "";
    rows.forEach(function (row) {
      if (!row.disabled) row.setAttribute("aria-checked", "false");
    });
    views.forEach(function (view) {
      view.data.np1 = "";
      view.data.np2 = "";
      view.data.exam = "";
      // Limpa também dados salvos pela versão anterior.
      delete view.data.frequency;
      delete view.data.usesPim;
      view.inputs.np1.value = "";
      view.inputs.np2.value = "";
      if (view.inputs.exam) view.inputs.exam.value = "";
    });
    save(STORAGE_KEY, state);
    save(LEGACY_KEY, legacy);
    save(GRADES_KEY, grades);
    renderAll();
    updateProgress();
  });

  renderAll();
  updateProgress();
})();
