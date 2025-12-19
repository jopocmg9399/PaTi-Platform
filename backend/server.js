// backend/server.js
app.post('/api/import', async (req, res) => {
  const data = req.body;
  // Lógica para importar datos a Pocketbase
  res.status(200).send('Datos importados con éxito');
});