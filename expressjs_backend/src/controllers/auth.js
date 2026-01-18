class AuthController {
  /**
   * PUBLIC_INTERFACE
   * Return the currently authenticated user based on the verified Supabase JWT.
   */
  me(req, res) {
    return res.status(200).json({
      user: req.user || null,
      auth: {
        // minimal debug info; do not echo token
        claims: req.auth?.claims || null,
      },
    });
  }
}

module.exports = new AuthController();
