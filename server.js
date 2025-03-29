const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({
    path: './config.env'
});

// Import the PostgreSQL module
const pgAdmin = require('./pgadmin');
process.on('uncaughtException', err => {
    console.log('UNCAUGHT EXCEPTION!!! shutting down...');
    console.log(err.name, err.message);
    process.exit(1);
});

const app = require('./app');

// MongoDB Connection
const database = process.env.DATABASE.replace('<PASSWORD>', process.env.DATABASE_PASSWORD);

// Connect MongoDB
mongoose.connect(database, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false
}).then(con => {
    console.log('MongoDB connection Successfully!');
});

// Initialize PostgreSQL connection
pgAdmin.initializePostgres()
    .then(connected => {
        if (connected) {
            console.log('PostgreSQL is ready to accept connections');
        } else {
            console.log('PostgreSQL connection issues - application continuing without PostgreSQL');
        }
    });

//Transection clenaup job
require('./middleware/trnsectionCleanupJob');

// Start the server
const port = process.env.PORT;
const server = app.listen(port, () => {
    console.log(`Application is running on port ${port}`);
});

process.on('unhandledRejection', err => {
    console.log('UNHANDLED REJECTION!!!  shutting down ...');
    console.log(err.name, err.message);
    server.close(() => {
        process.exit(1);
    });
});

// Proper application shutdown - close database connections
process.on('SIGTERM', () => {
    console.log('SIGTERM RECEIVED. Shutting down gracefully');
    server.close(async () => {
        console.log('Process terminated!');
        await pgAdmin.closePool();
        mongoose.connection.close(false, () => {
            console.log('MongoDB connection closed');
            process.exit(0);
        });
    });
});