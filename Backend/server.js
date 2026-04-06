import app from './src/app.js';
import connectDB from './src/config/database.js';
import env from './src/config/env.js';
import { initEmailTransporter } from './src/services/mail.service.js';
import { initQueueInfrastructure } from './src/queues/processing.queue.js';
import { configurePassport } from './src/config/passport.js';

await connectDB(env.MONGODB_URI);
configurePassport();
initQueueInfrastructure();

app.listen(env.PORT,()=>{
    console.log(`Server is running on port ${env.PORT}`);
});

// Non-critical startup work should not block process readiness on cold boots.
initEmailTransporter()
    .then((ok) => {
        if (!ok) {
            console.warn('Email transporter initialization skipped or failed.');
        }
    })
    .catch((error) => {
        console.warn(`Email transporter initialization error: ${error.message}`);
    });