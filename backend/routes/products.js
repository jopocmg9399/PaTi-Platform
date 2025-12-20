const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  const products = await pb.collection('products').find({});
  res.json(products);
});

module.exports = router;