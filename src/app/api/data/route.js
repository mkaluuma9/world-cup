import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import fs from 'fs';
import path from 'path';
import matches from '@/data/matches.json';

const isKVEnabled = !!process.env.KV_REST_API_URL;
const LOCAL_FILE = path.join(process.cwd(), 'local_db.json');

const INITIAL_USERS = {
    "Nash": "9046", "Werhub": "8242", "Mahad": "7846", "Ashraf": "2727", 
    "Razak": "5110", "Delu": "4935", "Faris": "3476", "Akram": "3355", 
    "Fahad": "7806", "Haan": "7612", "Yaya": "8250", "Badru": "8423"
};

async function readData() {
    if (isKVEnabled) {
        const data = await kv.get('wc_data');
        return data || { predictions: {}, results: {}, users: null };
    } else {
        if (fs.existsSync(LOCAL_FILE)) {
            return JSON.parse(fs.readFileSync(LOCAL_FILE, 'utf8'));
        }
        return { predictions: {}, results: {}, users: null };
    }
}

async function writeData(data) {
    if (isKVEnabled) {
        await kv.set('wc_data', data);
    } else {
        fs.writeFileSync(LOCAL_FILE, JSON.stringify(data, null, 2));
    }
}

export async function GET() {
    const data = await readData();

    if (!data.users || Object.keys(data.users).length === 0) {
        data.users = INITIAL_USERS;
        await writeData(data);
    }

    return NextResponse.json({
        users: data.users,
        matches: matches,
        predictions: data.predictions || {},
        results: data.results || {}
    });
}

export async function POST(req) {
    const body = await req.json();
    const data = await readData();
    
    if (!data.predictions) data.predictions = {};
    if (!data.results) data.results = {};

    if (body.type === 'PREDICTION') {
        const matchId = body.key.split('-')[0];
        const match = matches.find(m => m.id == matchId);
        if (match) {
            const lockTime = new Date(new Date(match.date).getTime() - 30 * 60000);
            if (new Date() > lockTime) {
                return NextResponse.json({ success: false, error: 'Match is locked' }, { status: 400 });
            }
        }
        data.predictions[body.key] = { t1: body.t1, t2: body.t2 };
    } else if (body.type === 'RESULT') {
        data.results[body.matchId] = { t1: body.t1, t2: body.t2 };
    } else if (body.type === 'ADD_USER') {
        if (!data.users) data.users = INITIAL_USERS;
        const pin = Math.floor(1000 + Math.random() * 9000).toString();
        data.users[body.user] = pin;
    }

    await writeData(data);
    return NextResponse.json({ success: true });
}
