require('dotenv').config()
const { Client, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadFile_ = async (filepath) => {
    try {
        const result = await cloudinary.uploader.upload(filepath, {
            folder: 'EEE355',
            resource_type: 'raw',
            public_id: `355_${Date.now()}`,
            overwrite: true,
        });

        // // Clean up the local file after upload
        // await fs.promises.unlink(filepath);

        console.log('Cloudinary upload successful:', result.secure_url);
        return result.secure_url;
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        throw error;
    }
}

// Create storage directory if it doesn't exist
const storageDir = './downloaded_images';
if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir);
}

// Initialize the WhatsApp client
const client = new Client({
    puppeteer: {
        args: ['--no-sandbox']
    }
});

// Configuration
// const TARGET_GROUP = 'Tesals sponsors GC';
const TARGET_GROUP = 'EEE 355 Courseware Chatroom';
const TARGET_SENDER = '2347064156849@c.us'; // Format: number@c.us


// Generate QR Code
client.on('qr', (qr) => {
    console.log('Scan this QR code in WhatsApp to log in:');
    qrcode.generate(qr, { small: true });
});

// Ready event
client.on('ready', () => {
    console.log('Client is ready!');
    console.log('Monitoring for images...');
});

// Handle incoming messages
client.on('message', async (message) => {
    try {
        // Check if message is from the target group
        const chat = await message.getChat();
        console.log(chat)
        const date = new Date();
        console.log("chat ", date)
        if (chat.name !== TARGET_GROUP) {
            return;
        }

        // Check if message is from target sender (if specified)
        // console.log(message.from)
        // if (TARGET_SENDER && message.from !== TARGET_SENDER) {
        //     return;
        // }

        // Check if message has media and is an image
        if (message.hasMedia) {
            const media = await message.downloadMedia();
            
            if (media.mimetype.startsWith('image/')) {
                // Generate filename with timestamp
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const extension = mime.extension(media.mimetype);
                const filename = `355_${timestamp}.${extension}`;
                const filepath = path.join(storageDir, filename);

                // Save image
                fs.writeFileSync(
                    filepath,
                    media.data,
                    'base64'
                );

                console.log(`Saved image: ${filepath}`);
                
                // Optional: Send confirmation message
                await message.reply('Thank you');
                
                // Upload to cloud (implement your preferred cloud storage)
                uploadFile_(filepath);
            }
        }
    } catch (error) {
        console.error('Error processing message:', error);
    }
});

// Cloud storage function (implement as needed)
async function uploadToCloud(filepath) {
    // Example implementation for AWS S3
    /*
    const AWS = require('aws-sdk');
    const s3 = new AWS.S3({
        accessKeyId: 'YOUR_ACCESS_KEY',
        secretAccessKey: 'YOUR_SECRET_KEY'
    });

    const fileContent = fs.readFileSync(filepath);
    const params = {
        Bucket: 'YOUR_BUCKET_NAME',
        Key: path.basename(filepath),
        Body: fileContent
    };

    try {
        await s3.upload(params).promise();
        console.log(`Uploaded to S3: ${filepath}`);
    } catch (error) {
        console.error('Error uploading to S3:', error);
    }
    */
}

// Handle authentication
client.on('authenticated', (session) => {
    console.log('Authentication successful!');
});

client.on('auth_failure', (error) => {
    console.error('Authentication failed:', error);
});

// Initialize the client
client.initialize(); 