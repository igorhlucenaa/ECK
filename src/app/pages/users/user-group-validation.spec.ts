import {
  normalizeUserGroupNameForComparison,
} from './user-group-validation';

describe('user-group-validation', () => {
  describe('normalizeUserGroupNameForComparison', () => {
    it('ignora maiúsculas, espaços extras e bordas', () => {
      expect(normalizeUserGroupNameForComparison('  Grupo   Teste  ')).toBe(
        normalizeUserGroupNameForComparison('grupo teste')
      );
    });

    it('retorna string vazia para entrada vazia', () => {
      expect(normalizeUserGroupNameForComparison('   ')).toBe('');
    });
  });
});
