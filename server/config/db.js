import mongoose from 'mongoose';

// Connects to MongoDB using the URI from environment variables.
//
// The connection is cached: the first call connects, and every later call
// reuses that same connection. Locally it is called once from server.js
// before the HTTP server starts listening. On Vercel the server is started
// on demand, so app.js also awaits it before handling each request.
let connectionPromise = null;

const connectDB = () => {
  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(process.env.MONGO_URI)
      .then((conn) => {
        console.log(`MongoDB connected: ${conn.connection.host}`);
        return conn;
      })
      .catch((error) => {
        connectionPromise = null; // allow a retry on the next call
        console.error(`MongoDB connection error: ${error.message}`);
        throw error;
      });
  }
  return connectionPromise;
};

export default connectDB;
