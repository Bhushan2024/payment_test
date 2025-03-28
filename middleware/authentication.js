const { promisify } = require("util");
const jwt = require("jsonwebtoken");
const { pgPool, query } = require("../pgadmin");
const AppError = require("../utils/appError");

exports.protect = async (req, res, next) => {
  try {
    // 1) Check if the token exists
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return next(new AppError(401, "fail", "You are not logged in! Please log in to continue"), req, res, next);
    }

    // 2) Verify the token
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    // 3) Check if user exists in PostgreSQL
    const userResult = await query('SELECT id, role FROM users WHERE id = $1', [decoded.id]);
    const user = userResult.rows[0];

    if (!user) {
      return next(new AppError(401, "fail", "This user no longer exists"), req, res, next);
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

// Authorization check if the user has permission
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, "fail", "You are not allowed to do this action"), req, res, next);
    }
    next();
  };
};

exports.decodeToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.id;
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
};



exports.delhiverytoken = async (req, res, next) => {
  try {
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Token")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }
    if (!token) {
      return next(
        new AppError(
          401,
          "fail",
          "Please Check Delhivery API Token",
        ),
        req,
        res,
        next,
      );
    }

    next();
  } catch (err) {
    next(err);
  }
};
