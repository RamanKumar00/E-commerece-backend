export const generateToken = (user, message, statusCode, res) => {
    const token = user.generateJsonWebToken(); // Generate JWT
  
    res.status(statusCode).json({
      success: true,
      message,
      user,
      token, // ✅ Return token in response
    });
  };
  