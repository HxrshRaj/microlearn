module.exports = {
  notFound: (req, res) => res.status(404).json({ error: 'Not found.' }),
  // eslint-disable-next-line no-unused-vars
  errorHandler: (err, req, res, next) => {
    if (err.status) return res.status(err.status).json({ error: err.message });
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Invalid request body.' });
    if (err.name === 'CastError') return res.status(400).json({ error: 'Invalid id.' });
    if (err.code === 11000) return res.status(409).json({ error: 'Already exists.' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  },
};
