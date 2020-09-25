module.exports = {
  path: '/test.data',
  method: 'GET',
  status: (req, res, next) => {
    if (req.params.foo === '999') {
      res.status(404);
    }
    next();
  },
  template: {
    toto: true,
  },
};
