const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const calc = require('./grades.js');

describe('shouldUsePim', () => {
    it('returns true for regular subjects (no tag)', () => {
        assert.strictEqual(calc.shouldUsePim({ tag: '' }), true);
    });

    it('returns true for regular subjects even without N2 and PIM', () => {
        assert.strictEqual(calc.shouldUsePim({ np1: 7, np2: '', pim: '' }), true);
    });

    it('returns false for DP subjects', () => {
        assert.strictEqual(calc.shouldUsePim({ tag: 'DP' }), false);
    });

    it('returns false for DP subjects regardless of filled grades', () => {
        assert.strictEqual(calc.shouldUsePim({ tag: 'DP', np2: 5, pim: 10 }), false);
    });

    it('returns true when called with no arguments', () => {
        assert.strictEqual(calc.shouldUsePim(), true);
    });
});

describe('Cenario 1: Regular N1=7, N2=7, PIM vazio => Pendente', () => {
    it('media deve ser pendente (null) porque PIM esta vazio', () => {
        const input = { np1: 7, np2: 7, pim: '', usesPim: true };
        const result = calc.calculate(input);
        assert.strictEqual(result.semester, null);
    });

    it('getRequiredGrade deve pedir PIM 5.50', () => {
        const input = { np1: 7, np2: 7, pim: '', usesPim: true };
        const req = calc.getRequiredGrade(input);
        assert.strictEqual(req.state, 'required');
        assert.strictEqual(req.field, 'pim');
        assert.strictEqual(req.value, 5.50);
    });
});

describe('Cenario 2: Regular N1=5, PIM=10, N2 vazia => Pendente, N2: 6.75', () => {
    it('media deve ser pendente (null) porque N2 esta vazia', () => {
        const input = { np1: 5, np2: '', pim: 10, usesPim: true };
        const result = calc.calculate(input);
        assert.strictEqual(result.semester, null);
    });

    it('getRequiredGrade deve pedir N2 6.75', () => {
        const input = { np1: 5, np2: '', pim: 10, usesPim: true };
        const req = calc.getRequiredGrade(input);
        assert.strictEqual(req.state, 'required');
        assert.strictEqual(req.field, 'np2');
        assert.strictEqual(req.value, 6.75);
    });
});

describe('Cenario 3: Regular N1=8, N2=6, PIM=7 => Media 7.0, Atingida', () => {
    it('media deve ser 7.0', () => {
        // (8*4 + 6*4 + 7*2) / 10 = (32+24+14)/10 = 70/10 = 7.0
        const input = { np1: 8, np2: 6, pim: 7, usesPim: true };
        const result = calc.calculate(input);
        assert.strictEqual(result.semester, 7.0);
    });

    it('getRequiredGrade deve retornar achieved', () => {
        const input = { np1: 8, np2: 6, pim: 7, usesPim: true };
        const req = calc.getRequiredGrade(input);
        assert.strictEqual(req.state, 'achieved');
    });
});

describe('Cenario 4: DP N1=5, N2=5 => Media 5.0, exame 4.50', () => {
    it('media deve ser 5.0 independente do PIM', () => {
        const input = { np1: 5, np2: 5, usesPim: false };
        const result = calc.calculate(input);
        assert.strictEqual(result.semester, 5.0);
    });

    it('getRequiredGrade deve pedir exame 4.50', () => {
        const input = { np1: 5, np2: 5, usesPim: false };
        const req = calc.getRequiredGrade(input);
        assert.strictEqual(req.state, 'required');
        assert.strictEqual(req.field, 'exam');
        assert.strictEqual(req.value, 4.50);
    });

    it('shouldUsePim retorna false para DP com PIM=0', () => {
        assert.strictEqual(calc.shouldUsePim({ tag: 'DP', pim: 0 }), false);
    });

    it('shouldUsePim retorna false para DP com PIM=5', () => {
        assert.strictEqual(calc.shouldUsePim({ tag: 'DP', pim: 5 }), false);
    });

    it('shouldUsePim retorna false para DP com PIM=10', () => {
        assert.strictEqual(calc.shouldUsePim({ tag: 'DP', pim: 10 }), false);
    });

    it('shouldUsePim retorna false para DP com PIM vazio', () => {
        assert.strictEqual(calc.shouldUsePim({ tag: 'DP', pim: '' }), false);
    });
});

describe('Cenario 5: DP N1=8, N2=6, PIM vazio => Media 7.0, Atingida', () => {
    it('media deve ser 7.0', () => {
        // (8 + 6) / 2 = 7.0
        const input = { np1: 8, np2: 6, usesPim: false };
        const result = calc.calculate(input);
        assert.strictEqual(result.semester, 7.0);
    });

    it('getRequiredGrade deve retornar achieved', () => {
        const input = { np1: 8, np2: 6, usesPim: false };
        const req = calc.getRequiredGrade(input);
        assert.strictEqual(req.state, 'achieved');
    });
});

describe('Provisorio: NP1=10, sem NP2 nem PIM => precisa 4 na NP2', () => {
    it('getRequiredGrade deve pedir NP2 4.00', () => {
        const req = calc.getRequiredGrade({ np1: 10, np2: '', pim: '', usesPim: true });
        assert.strictEqual(req.state, 'required');
        assert.strictEqual(req.field, 'np2');
        assert.strictEqual(req.value, 4);
    });

    it('calculate deve retornar np2Needed 4.00', () => {
        const result = calc.calculate({ np1: 10, np2: '', pim: '', usesPim: true });
        assert.strictEqual(result.np2Needed, 4);
        assert.strictEqual(result.semesterOfficial, null);
    });
});

describe('Provisorio: NP1=7, sem NP2 nem PIM => precisa 7 na NP2', () => {
    it('getRequiredGrade deve pedir NP2 7.00', () => {
        const req = calc.getRequiredGrade({ np1: 7, np2: '', pim: '', usesPim: true });
        assert.strictEqual(req.state, 'required');
        assert.strictEqual(req.field, 'np2');
        assert.strictEqual(req.value, 7);
    });
});

describe('Provisorio: NP1=5, sem NP2 nem PIM => precisa 9 na NP2', () => {
    it('getRequiredGrade deve pedir NP2 9.00', () => {
        const req = calc.getRequiredGrade({ np1: 5, np2: '', pim: '', usesPim: true });
        assert.strictEqual(req.state, 'required');
        assert.strictEqual(req.field, 'np2');
        assert.strictEqual(req.value, 9);
    });
});

describe('Provisorio: NP1=3, sem NP2 nem PIM => media 7 inviavel', () => {
    it('getRequiredGrade deve retornar impossible', () => {
        const req = calc.getRequiredGrade({ np1: 3, np2: '', pim: '', usesPim: true });
        assert.strictEqual(req.state, 'impossible');
        assert.strictEqual(req.field, 'np2');
        assert.ok(req.value > 10);
    });
});

describe('Provisorio: NP1=10, NP2=4, sem PIM => media provisoria 7', () => {
    it('calculate deve retornar provisionalSemester 7.0', () => {
        const result = calc.calculate({ np1: 10, np2: 4, pim: '', usesPim: true });
        assert.strictEqual(result.provisionalSemester, 7);
        assert.strictEqual(result.semesterOfficial, null);
    });
});

describe('Definitivo: NP1=10, NP2=4, PIM=7 => media final 7', () => {
    it('calculate deve retornar semester 7.0', () => {
        const result = calc.calculate({ np1: 10, np2: 4, pim: 7, usesPim: true });
        assert.strictEqual(result.semester, 7);
        assert.strictEqual(result.semesterOfficial, 7);
    });
});

describe('Definitivo: NP1=8, NP2=6, PIM=10 => media final 7.6', () => {
    it('calculate deve retornar semester 7.6', () => {
        const result = calc.calculate({ np1: 8, np2: 6, pim: 10, usesPim: true });
        assert.strictEqual(result.semester, 7.6);
        assert.strictEqual(result.semesterOfficial, 7.6);
    });
});

describe('Definitivo: NP1=5, NP2=5, PIM=5 => media final 5', () => {
    it('calculate deve retornar semester 5.0', () => {
        const result = calc.calculate({ np1: 5, np2: 5, pim: 5, usesPim: true });
        assert.strictEqual(result.semester, 5);
    });
});

describe('DP: NP1=10, NP2 vazia => NP2 necessária 3,40', () => {
    it('getRequiredGrade deve pedir NP2 3.40', () => {
        const req = calc.getRequiredGrade({ np1: 10, np2: '', usesPim: false });
        assert.strictEqual(req.state, 'required');
        assert.strictEqual(req.field, 'np2');
        assert.strictEqual(req.value, 3.40);
    });

    it('calculate deve retornar np2Needed 3.40', () => {
        const result = calc.calculate({ np1: 10, np2: '', usesPim: false });
        assert.strictEqual(result.np2Needed, 3.40);
    });
});

describe('DP: NP1=7, NP2 vazia => NP2 necessária 6,40', () => {
    it('getRequiredGrade deve pedir NP2 6.40', () => {
        const req = calc.getRequiredGrade({ np1: 7, np2: '', usesPim: false });
        assert.strictEqual(req.state, 'required');
        assert.strictEqual(req.field, 'np2');
        assert.strictEqual(req.value, 6.40);
    });
});

describe('DP: NP1=5, NP2 vazia => NP2 necessária 8,40', () => {
    it('getRequiredGrade deve pedir NP2 8.40', () => {
        const req = calc.getRequiredGrade({ np1: 5, np2: '', usesPim: false });
        assert.strictEqual(req.state, 'required');
        assert.strictEqual(req.field, 'np2');
        assert.strictEqual(req.value, 8.40);
    });
});

describe('DP: NP1=3, NP2 vazia => aprovação direta inviável', () => {
    it('getRequiredGrade deve retornar impossible', () => {
        const req = calc.getRequiredGrade({ np1: 3, np2: '', usesPim: false });
        assert.strictEqual(req.state, 'impossible');
        assert.strictEqual(req.field, 'np2');
        assert.ok(req.value > 10);
    });
});

describe('DP: NP1=10, NP2=3.4 => aprovado por arredondamento', () => {
    it('calculate deve retornar semesterOfficial 7', () => {
        const result = calc.calculate({ np1: 10, np2: 3.4, usesPim: false });
        assert.strictEqual(result.semester, 6.7);
        assert.strictEqual(result.semesterOfficial, 7);
        assert.strictEqual(result.examRequired, false);
    });
});

describe('DP: NP1=7, NP2=7 => aprovado diretamente', () => {
    it('calculate deve retornar semester 7.0', () => {
        const result = calc.calculate({ np1: 7, np2: 7, usesPim: false });
        assert.strictEqual(result.semester, 7);
        assert.strictEqual(result.semesterOfficial, 7);
        assert.strictEqual(result.examRequired, false);
    });
});

describe('DP: NP1=5, NP2=5 => exame necessário, nota mínima 4,50', () => {
    it('calculate deve retornar examNeeded 4.50', () => {
        const result = calc.calculate({ np1: 5, np2: 5, usesPim: false });
        assert.strictEqual(result.examRequired, true);
        assert.strictEqual(result.examNeeded, 4.50);
    });
});

describe('DP: NP1=5, NP2=5, Exame=4.5 => aprovado por arredondamento', () => {
    it('calculate deve retornar finalOfficial 5', () => {
        const result = calc.calculate({ np1: 5, np2: 5, exam: 4.5, usesPim: false });
        assert.strictEqual(result.final, 4.75);
        assert.strictEqual(result.finalOfficial, 5);
    });
});

describe('DP: NP1=5, NP2=5, Exame=4 => reprovado', () => {
    it('calculate deve retornar final < 5', () => {
        const result = calc.calculate({ np1: 5, np2: 5, exam: 4, usesPim: false });
        assert.strictEqual(result.final, 4.5);
        assert.strictEqual(result.finalOfficial, 4.5);
    });
});

describe('DP: NP1=8, NP2=5 => exame necessário, nota mínima 3,00', () => {
    it('calculate deve retornar examNeeded 3.00', () => {
        const result = calc.calculate({ np1: 8, np2: 5, usesPim: false });
        assert.strictEqual(result.examRequired, true);
        assert.strictEqual(result.examNeeded, 3);
    });
});

describe('DP: NP1=8, NP2=5, Exame=3 => aprovado por arredondamento', () => {
    it('calculate deve retornar finalOfficial 5', () => {
        const result = calc.calculate({ np1: 8, np2: 5, exam: 3, usesPim: false });
        assert.strictEqual(result.final, 4.75);
        assert.strictEqual(result.finalOfficial, 5);
    });
});

describe('DP: notas zero e dez', () => {
    it('NP1=0, NP2=0 => media 0, exame necessário com nota 9.50', () => {
        const result = calc.calculate({ np1: 0, np2: 0, usesPim: false });
        assert.strictEqual(result.semester, 0);
        assert.strictEqual(result.examRequired, true);
        assert.strictEqual(result.examNeeded, 9.50);
    });

    it('NP1=10, NP2=10 => media 10, aprovado diretamente', () => {
        const result = calc.calculate({ np1: 10, np2: 10, usesPim: false });
        assert.strictEqual(result.semester, 10);
        assert.strictEqual(result.examRequired, false);
    });

    it('NP1=0 => NP2 impossível (13.40)', () => {
        const req = calc.getRequiredGrade({ np1: 0, np2: '', usesPim: false });
        assert.strictEqual(req.state, 'impossible');
        assert.ok(req.value > 10);
    });
});

describe('DP: campos vazios não são zero', () => {
    it('ambos vazios => media pendente', () => {
        const result = calc.calculate({ np1: '', np2: '', usesPim: false });
        assert.strictEqual(result.semester, null);
    });

    it('NP2 vazia não é interpretada como zero', () => {
        const result = calc.calculate({ np1: 10, np2: '', usesPim: false });
        assert.strictEqual(result.semester, null);
        assert.strictEqual(result.np2Needed, 3.40);
    });

    it('exame vazio com media abaixo não gera reprovação', () => {
        const result = calc.calculate({ np1: 5, np2: 5, exam: '', usesPim: false });
        assert.strictEqual(result.examRequired, true);
        assert.strictEqual(result.final, null);
    });
});

describe('DP: fronteiras de arredondamento', () => {
    it('MS=6.69 não arredonda para 7 (exame necessário)', () => {
        const result = calc.calculate({ np1: 6.69, np2: 6.69, usesPim: false });
        assert.ok(result.semester < 6.7);
        assert.strictEqual(result.examRequired, true);
    });

    it('MS=6.70 arredonda para 7 (aprovado)', () => {
        const result = calc.calculate({ np1: 6.7, np2: 6.7, usesPim: false });
        assert.strictEqual(result.semester, 6.7);
        assert.strictEqual(result.semesterOfficial, 7);
        assert.strictEqual(result.examRequired, false);
    });

    it('MF=4.74 não arredonda para 5 (reprovado)', () => {
        const result = calc.calculate({ np1: 5, np2: 5, exam: 4.48, usesPim: false });
        assert.ok(result.final < 4.75);
        assert.ok(result.finalOfficial < 5);
    });

    it('MF=4.75 arredonda para 5 (aprovado)', () => {
        const result = calc.calculate({ np1: 5, np2: 5, exam: 4.5, usesPim: false });
        assert.strictEqual(result.final, 4.75);
        assert.strictEqual(result.finalOfficial, 5);
    });
});

describe('Integracao: shouldUsePim + calculate', () => {
    it('regular com todos os campos preenchidos calcula corretamente', () => {
        const input = { np1: 8, np2: 6, pim: 7, tag: '' };
        input.usesPim = calc.shouldUsePim(input);
        assert.strictEqual(input.usesPim, true);
        const result = calc.calculate(input);
        assert.strictEqual(result.semester, 7.0);
    });

    it('regular sem PIM fica com media definitiva pendente e provisoria calculada', () => {
        const input = { np1: 7, np2: 7, pim: '', tag: '' };
        input.usesPim = calc.shouldUsePim(input);
        assert.strictEqual(input.usesPim, true);
        const result = calc.calculate(input);
        assert.strictEqual(result.semester, null);
        assert.strictEqual(result.provisionalSemester, 7);
    });

    it('DP ignora PIM e calcula media simples', () => {
        const input = { np1: 5, np2: 5, pim: 10, tag: 'DP' };
        input.usesPim = calc.shouldUsePim(input);
        assert.strictEqual(input.usesPim, false);
        const result = calc.calculate(input);
        assert.strictEqual(result.semester, 5.0);
    });
});
