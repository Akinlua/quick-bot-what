require('dotenv').config()
const { Client, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

const cloudinary = require('cloudinary').v2;

const tf = require('@tensorflow/tfjs-node');
const mobilenet = require('@tensorflow-models/mobilenet');
const cocoSsd = require('@tensorflow-models/coco-ssd');

const { HfInference } = require('@huggingface/inference');

// Load models once at startup
let mobileNetModel;
let cocoModel;

async function loadModels() {
    console.log("loading models")
    mobileNetModel = await mobilenet.load();
    cocoModel = await cocoSsd.load();
    console.log('AI Models loaded successfully!');
}

loadModels();

async function analyzeImage(filepath) {
    try {
        // Read the file and convert it to the correct format
        const imageBuffer = fs.readFileSync(filepath);
        
        // Check if the image is in WebP format
        if (filepath.endsWith('.webp')) {
            // If you want to handle WebP, you'll need to convert it first
            // For now, we'll skip analysis for WebP images
            return null;
        }
        console.log("imageBuffer")

        // Create a buffer from the image data
        const image = await tf.node.decodeImage(imageBuffer, 3); // 3 channels for RGB
        
        // Get general classification
        const mobileNetPredictions = await mobileNetModel.classify(image);
        
        // Get object detection
        const cocoDetections = await cocoModel.detect(image);
        
        // Clean up tensor
        image.dispose();
        
        return {
            classifications: mobileNetPredictions,
            detections: cocoDetections
        };
    } catch (error) {
        console.error('Image analysis error:', error);
        return null;
    }
}

// Initialize HuggingFace with your token
const hf = new HfInference(process.env.HUGGINGFACE_TOKEN);

async function generateResponse(context) {
    try {
        // const prompt = `Generate a single short, funny response to "${context}" in a WhatsApp group chat. Use emojis. IMPORTANT: Don't make it look robotic.`;
        
        const prompt = `Generate a funny and casual response for receiving a ${context} in a WhatsApp group. 
        The response should be short, use emojis, and sound natural like a friend responding. 
        Make it humorous but not robotic.`;

        const response = await hf.textGeneration({
            model: 'HuggingFaceH4/zephyr-7b-beta',
            inputs: prompt,
            parameters: {
                max_new_tokens: 50,
                temperature: 0.9,
                top_p: 0.95,
                repetition_penalty: 1.1
            }
        });
        console.log("response")
        console.log(response.generated_text)

        // Parse the response and clean it up
        let generatedResponse = response.generated_text
            .split('\n')
            .pop()  // Get the last line which should be the actual response
            .replace(/^["'\s]+|["'\s]+$/g, '')  // Remove quotes and spaces
            .replace(/Generate .+emojis\. |Please .+|Could you .+/g, '')  // Remove common request phrases
            .trim();

        console.log("generatedResponse")
        console.log(generatedResponse)

        // If response is too long or empty, use fallback
        if (generatedResponse.length > 1000 || generatedResponse.length < 1) {
            throw new Error('Invalid response length');
        }

        // Add emojis if none present
        if (!generatedResponse.match(/[\u{1F300}-\u{1F9FF}]/u)) {
            const emojis = ['😂', '🔥', '👌', '💫', '✨', '🎯', '🚀', '💪'];
            generatedResponse += ' ' + emojis[Math.floor(Math.random() * emojis.length)];
        }

        return generatedResponse;
    } catch (error) {
        console.error('Error generating response:', error);
        // Fallback responses
        const fallbackResponses = [
            "That's awesome! 🔥",
            "Love it! 💫",
            "This is gold! ✨",
            "Perfect timing! 🎯",
            "Brilliant! 🚀",
            "This made my day! 😂",
            "Absolutely fantastic! 💪",
            "You're on fire! 🌟"
        ];
        return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
    }
}

const getContextualResponse = (analysis) => {
    if (!analysis) return "Got it! 👍";

    const responses = {
        meme: [
            "This meme is speaking facts! 😂",
            "My meme detector is off the charts! 🎯",
            "Finally, some good meme content 👌",
            "This one's going viral in my circuits! 🚀",
            "Meme level: Legendary 🏆"
        ],
        person: [
            "Looking good! 🌟",
            "That pose though! 📸",
            "Frame-worthy moment! 🖼️",
            "This one's a keeper! ✨",
            "Perfect timing! 👌"
        ],
        animal: [
            "Aww, so cute! 🐾",
            "Pet content = best content 🐱",
            "Who's a good boy/girl? 🐶",
            "My heart just melted! 💖",
            "Animal content supremacy! 🦁"
        ],
        food: [
            "Looking delicious! 😋",
            "Food pics are my weakness! 🍜",
            "Gordon Ramsay would be proud! 👨‍🍳",
            "This made me hungry! 🍽️",
            "Foodie approved! ⭐"
        ],
        sticker: [
            "Sticker game: Certified fresh ✨",
            "This sticker is my spirit animal 🐼",
            "Adding this to my emotional support stickers 🎭",
            "Perfect sticker doesn't exi- oh wait! 😍",
            "This sticker speaks to my soul 💫"
        ],
        default: [
            "This is gold! 🎯",
            "Quality content alert! ⚡",
            "My collection keeps getting better! 💫",
            "This one's special! ✨",
            "Adding this to my favorites! 🌟"
        ]
    };

    // Analyze the predictions
    const labels = analysis.classifications.map(p => p.className.toLowerCase());
    const detections = analysis.detections.map(d => d.class.toLowerCase());
    
    // Check for specific content types
    if (labels.some(l => l.includes('text') || l.includes('meme') || l.includes('cartoon'))) {
        return responses.meme[Math.floor(Math.random() * responses.meme.length)];
    }
    if (detections.includes('person')) {
        return responses.person[Math.floor(Math.random() * responses.person.length)];
    }
    if (detections.some(d => ['cat', 'dog', 'bird', 'animal'].includes(d))) {
        return responses.animal[Math.floor(Math.random() * responses.animal.length)];
    }
    if (labels.some(l => l.includes('food') || l.includes('dish'))) {
        return responses.food[Math.floor(Math.random() * responses.food.length)];
    }
    if (labels.some(l => l.includes('sticker') || l.includes('cartoon'))) {
        return responses.sticker[Math.floor(Math.random() * responses.sticker.length)];
    }
    
    return responses.default[Math.floor(Math.random() * responses.default.length)];
};




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
const TARGET_GROUP = 'Tesals sponsors GC';
// const TARGET_GROUP = 'EEE 355 Courseware Chatroom';
const TARGET_SENDER = '2347064156849@c.us'; // Format: number@c.us

const imageResponses = [
    "Sticker game strong! 😎 *saves with style*",
    "This one's going in my premium sticker collection 👀",
    "Finally! A sticker worthy of my storage space 🏆",
    "My storage was waiting for this moment 💃",
    "Consider this stolen... legally of course 😌",
    "Hippity hoppity, this sticker is now my property 🐰",
    "My meme folder thanks you for your service 🫡",
    "Achievement unlocked: Epic sticker acquired! 🎮",
    "My WhatsApp game just leveled up 📈",
    "This is the way! *mandalorian nod* 🤖",
    "Ah, I see you're a person of culture as well 🧐",
    "Adding this to my 'make people laugh' arsenal 🎯",
    "This sparks joy. Definitely keeping this one ✨",
    "My collection grows stronger 💪",
    "Yoink! Thanks for the contribution 🏃‍♂️",
    "This is the kind of quality content I signed up for 🔥",
    "Mission accomplished: Epic content secured 🕵️‍♂️",
    "My sticker folder: *happy noises* 📁",
    "Chef's kiss for this one 🤌",
    "10/10 would save again 💯"
];

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
                
                // Skip WebP images or convert them if needed
                if (extension === 'webp') {
                    // For now, we'll skip WebP images
                    const response = await generateResponse('sticker or image');
                    await message.reply(response);
                    return;
                }

                const filename = `355_${timestamp}.${extension}`;
                const filepath = path.join(storageDir, filename);

                // Save image as binary data instead of base64
                fs.writeFileSync(
                    filepath,
                    Buffer.from(media.data, 'base64')
                );

                console.log(`Saved image ${filepath}`);

                // Analyze image and generate contextual response
                const analysis = await analyzeImage(filepath);
                console.log(analysis);

                // Delete the image file after analysis
                fs.unlinkSync(filepath);
                console.log(`Deleted temporary image file: ${filepath}`);

                // Create context from analysis
                let context = 'image';
                if (analysis) {
                    if (analysis.classifications.length > 0) {
                        context = analysis.classifications[0].className.toLowerCase();
                    }
                    if (analysis.detections.length > 0) {
                        context += ` with ${analysis.detections.map(d => d.class).join(', ')}`;
                    }
                }

                console.log(context)
                const response = await generateResponse(context);
                await message.reply(response);
                
                // Optional: Send confirmation message
                // const randomResponse = imageResponses[Math.floor(Math.random() * imageResponses.length)];
                // await message.reply(randomResponse);
                
                // Upload to cloud (implement your preferred cloud storage)
                // uploadFile_(filepath);
            }
        } else if (message.body ) { // 10% chance to respond to text
            try {
                console.log("text")
                const response = await generateResponse(`text message saying "${message.body}"`);
                await message.reply(response);
            } catch (error) {
                // Fallback to predefined responses if AI generation fails
                const textResponses = [
                    "Facts! 💯",
                    "You might be onto something 🤔",
                    "This conversation is getting interesting 👀",
                    "Spitting facts! 🎯",
                    "W take! 🔥",
                    "Based opinion 💫",
                    "This is the way! 🚀",
                    "No cap detected! 🧢❌",
                    "Valid point! 💡",
                    "You're speaking my language! 🗣️"
                ];
                const randomResponse = textResponses[Math.floor(Math.random() * textResponses.length)];
                await message.reply(randomResponse);
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


// generateResponse("the person is a meme")