const session = require("express-session");
const MySQLStoreFactory = require("express-mysql-session");
const { config } = require("./env");
const { pool } = require("./database");
const MySQLStore = MySQLStoreFactory(session);
const ttlMilliseconds = config.session.ttlHours * 60 * 60 * 1000;
const store = new MySQLStore(
  {
    clearExpired: true,
    checkExpirationInterval: 15 * 60 * 1000,
    expiration: ttlMilliseconds,
    createDatabaseTable: false,
    endConnectionOnClose: false,
    charset: "utf8mb4_bin",
    schema: {
      tableName: "admin_sessions",
      columnNames: {
        session_id: "session_id",
        expires: "expires",
        data: "data",
      },
    },
  },
  pool,
);

const sessionStoreReady = store.onReady();
const sessionMiddleware = session({
  name: config.session.name,
  secret: config.session.secret,
  store,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  proxy: config.trustProxy > 0,
  cookie: {
    httpOnly: true,
    secure: config.session.secure,
    sameSite: config.session.sameSite,
    maxAge: ttlMilliseconds,
    path: "/api/admin",
  },
});

module.exports = {
  sessionMiddleware,
  sessionStore: store,
  sessionStoreReady,
};
