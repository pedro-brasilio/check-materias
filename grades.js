(function (root, factory) {
    'use strict';

    const calculator = factory();
    if (typeof module === 'object' && module.exports) module.exports = calculator;
    if (root) root.GradeCalculator = calculator;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const STATUS = Object.freeze({
        DIRECT: 'Aprovado diretamente',
        EXAM: 'Exame necessário',
        AFTER_EXAM: 'Aprovado após exame',
        FAILED_GRADE: 'Reprovado por nota',
        FAILED_ATTENDANCE: 'Reprovado por frequência',
        PENDING: 'Aguardando lançamento de notas'
    });

    function parseValue(raw, max = 10) {
        if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')) {
            return { value: null, error: null };
        }
        if (typeof raw !== 'string' && typeof raw !== 'number') {
            return { value: null, error: 'Informe um número válido.' };
        }

        const text = String(raw).trim();
        if (!/^-?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(text)) {
            return { value: null, error: 'Informe um número válido, usando vírgula ou ponto.' };
        }

        const value = Number(text.replace(',', '.'));
        if (!Number.isFinite(value) || value < 0 || value > max) {
            return { value: null, error: `Informe um valor entre 0 e ${max}.` };
        }
        const decimal = text.split(/[.,]/)[1];
        if (decimal && decimal.length > 2) {
            return { value: null, error: 'Use no máximo duas casas decimais.' };
        }

        return { value: Object.is(value, -0) ? 0 : value, error: null };
    }

    function calculate(input = {}) {
        const source = input && typeof input === 'object' ? input : {};
        const usesPim = source.usesPim === true ? true : source.usesPim === false ? false : null;
        const parsed = {
            np1: parseValue(source.np1),
            np2: parseValue(source.np2),
            frequency: parseValue(source.frequency, 100)
        };
        if (usesPim === true) parsed.pim = parseValue(source.pim);

        const result = {
            status: STATUS.PENDING,
            tone: 'pending',
            semester: null,
            semesterOfficial: null,
            final: null,
            finalOfficial: null,
            np2Needed: null,
            examNeeded: null,
            examRequired: null,
            errors: {},
            missing: []
        };

        for (const [field, entry] of Object.entries(parsed)) {
            if (entry.error) result.errors[field] = entry.error;
            if (entry.value === null) result.missing.push(field);
        }
        if (usesPim === null) result.missing.push('usesPim');

        // Input values have at most two decimal places. Integer hundredths keep
        // boundary decisions exact, including the minimum required next grade.
        const units = field => parsed[field].value === null ? null : Math.round(parsed[field].value * 100);
        const np1 = units('np1');
        const np2 = units('np2');
        const pim = usesPim === true ? units('pim') : null;
        let semesterMilli = null;

        if (np1 !== null && usesPim !== null && (usesPim === false || pim !== null)) {
            const knownWeighted = usesPim ? np1 * 4 + pim * 2 : np1 * 5;
            const np2Weight = usesPim ? 4 : 5;
            result.np2Needed = Math.max(0, Math.ceil((6700 - knownWeighted) / np2Weight)) / 100;

            if (np2 !== null) {
                semesterMilli = knownWeighted + np2 * np2Weight;
                result.semester = semesterMilli / 1000;
                result.semesterOfficial = semesterMilli >= 6700 && semesterMilli < 7000
                    ? 7 : result.semester;
            }
        }

        const frequency = parsed.frequency.value;
        if (frequency !== null && frequency < 75) {
            result.status = STATUS.FAILED_ATTENDANCE;
            result.tone = 'danger';
            result.examRequired = false;
            result.np2Needed = null;
            return result;
        }

        if (semesterMilli === null) return result;

        result.examRequired = semesterMilli < 6700;
        if (!result.examRequired) {
            if (frequency !== null) {
                result.status = STATUS.DIRECT;
                result.tone = 'success';
            }
            return result;
        }

        // MF >= 4.75 is equivalent to MS + EX >= 9.5. Always round
        // the requested grade upward to a hundredth, never to the nearest one.
        result.examNeeded = Math.max(0, Math.ceil((9500 - semesterMilli) / 10)) / 100;
        const exam = parseValue(source.exam);
        if (exam.error) result.errors.exam = exam.error;
        if (exam.value === null) result.missing.push('exam');

        if (exam.value !== null) {
            const finalNumerator = semesterMilli + Math.round(exam.value * 100) * 10;
            result.final = finalNumerator / 2000;
            result.finalOfficial = finalNumerator >= 9500 && finalNumerator < 10000 ? 5 : result.final;
            if (frequency !== null) {
                result.status = finalNumerator >= 9500 ? STATUS.AFTER_EXAM : STATUS.FAILED_GRADE;
                result.tone = finalNumerator >= 9500 ? 'success' : 'danger';
            }
        } else if (frequency !== null && !exam.error) {
            result.status = STATUS.EXAM;
            result.tone = 'warning';
        }

        return result;
    }

    function shouldUsePim(input = {}) {
        const source = input && typeof input === 'object' ? input : {};
        // DP subjects are graded only by (N1 + N2) / 2; PIM never participates.
        if (source.tag === 'DP') return false;
        const isPresent = value => value !== null && value !== undefined && !(typeof value === 'string' && value.trim() === '');
        return isPresent(source.np2) && isPresent(source.pim);
    }

    function getRequiredGrade(input = {}) {
        const source = input && typeof input === 'object' ? input : {};
        const usesPim = source.usesPim !== false;
        const weights = usesPim ? { np1: 4, np2: 4, pim: 2 } : { np1: 5, np2: 5 };
        const parsed = {};
        const missing = [];
        const pending = { state: 'pending', field: null, value: null };

        for (const field of Object.keys(weights)) {
            parsed[field] = parseValue(source[field]);
            if (parsed[field].error) return pending;
            if (parsed[field].value === null) missing.push(field);
        }

        if (missing.length > 1) return pending;
        if (missing.length === 1) {
            const field = missing[0];
            let knownWeighted = 0;
            for (const key of Object.keys(weights)) {
                if (key !== field) knownWeighted += Math.round(parsed[key].value * 100) * weights[key];
            }
            const value = Math.max(0, Math.ceil((6700 - knownWeighted) / weights[field])) / 100;
            return { state: value > 10 ? 'impossible' : 'required', field, value };
        }

        const result = calculate({
            np1: parsed.np1.value,
            np2: parsed.np2.value,
            pim: usesPim ? parsed.pim.value : undefined,
            usesPim
        });
        return result.examRequired
            ? { state: 'required', field: 'exam', value: result.examNeeded }
            : { state: 'achieved', field: null, value: null };
    }

    return Object.freeze({ STATUS, parseValue, calculate, getRequiredGrade, shouldUsePim });
});
