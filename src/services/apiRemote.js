import httpClient from './apiClient.js';

async function getAll() {
  const { data } = await httpClient.get('/blueprints');
  return data;
}

async function getByAuthor(author) {
  const { data } = await httpClient.get(
    `/blueprints?author=${encodeURIComponent(author)}`
  );

  return data;
}

async function getByAuthorAndName(author, name) {
  const { data } = await httpClient.get(
    `/blueprints/${encodeURIComponent(author)}/${encodeURIComponent(name)}`
  );

  return data;
}

async function create(author, blueprint) {
  const { data } = await httpClient.post('/blueprints', {
    author,
    name: blueprint.name,
    points: blueprint.points ?? [],
  });

  return data;
}

async function update(author, name, blueprint) {
  const { data } = await httpClient.put(
    `/blueprints/${encodeURIComponent(author)}/${encodeURIComponent(name)}`,
    {
      name,
      points: blueprint.points ?? [],
    }
  );

  return data;
}

async function remove(author, name) {
  await httpClient.delete(
    `/blueprints/${encodeURIComponent(author)}/${encodeURIComponent(name)}`
  );

  return {
    author,
    name,
  };
}

const apiRemote = {
  getAll,
  getByAuthor,
  getByAuthorAndName,
  create,
  update,
  remove,
};

export default apiRemote;