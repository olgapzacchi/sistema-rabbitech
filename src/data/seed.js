// Dados iniciais (modo local). No Supabase, os mesmos dados vêm da migração.
const now = new Date().toISOString();
const names = ['Luiz', 'Nayon', 'Arthur', 'Fernanda', 'Eduarda', 'Nayane', 'Lucas', 'Laysa', 'Jamilly', 'Tayonara'];

export const seedData = {
  members: names.map((name, i) => ({ id: 'm' + (i + 1), name, group_name: '', created_at: now })),
  strategies: [{ id: 's1', name: 'Estratégia principal', notes: '', plan_b: '', created_at: now }],
  media_links: [],
};
