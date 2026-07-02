import { NextResponse } from 'next/server';
import { createClient } from 'redis';
import fs from 'fs';
import path from 'path';

const isRedisEnabled = !!process.env.REDIS_URL;
const LOCAL_FILE = path.join(process.cwd(), 'local_db.json');

let redisClient = null;

async function getRedisClient() {
    if (!redisClient) {
        redisClient = createClient({ url: process.env.REDIS_URL });
        redisClient.on('error', err => console.error('Redis Client Error', err));
        await redisClient.connect();
    }
    return redisClient;
}

async function readData() {
    if (isRedisEnabled) {
        const client = await getRedisClient();
        const dataStr = await client.get('wc_data');
        return dataStr ? JSON.parse(dataStr) : { predictions: {}, results: {}, users: {} };
    } else {
        if (fs.existsSync(LOCAL_FILE)) {
            return JSON.parse(fs.readFileSync(LOCAL_FILE, 'utf8'));
        }
        return { predictions: {}, results: {}, users: {} };
    }
}

async function writeData(data) {
    if (isRedisEnabled) {
        const client = await getRedisClient();
        await client.set('wc_data', JSON.stringify(data));
    } else {
        fs.writeFileSync(LOCAL_FILE, JSON.stringify(data, null, 2));
    }
}

export async function GET() {
    try {
        const data = await readData();
        
        let migratedCount = 0;
        
        // 1. Migrate predictions
        if (data.predictions) {
            const newPredictions = {};
            for (const [key, value] of Object.entries(data.predictions)) {
                if (key.endsWith('-Iman')) {
                    const newKey = key.replace('-Iman', '-Imam');
                    newPredictions[newKey] = value;
                    migratedCount++;
                } else {
                    newPredictions[key] = value;
                }
            }
            data.predictions = newPredictions;
        }

        // 2. Ensure user is Imam
        if (data.users && data.users['Iman']) {
            data.users['Imam'] = data.users['Iman'];
            delete data.users['Iman'];
        }
        
        await writeData(data);
        
        return NextResponse.json({ 
            success: true, 
            message: `Migrated ${migratedCount} predictions from Iman to Imam. User account updated.`,
            predictions: data.predictions
        });
        
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
