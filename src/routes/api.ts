import express, { Request, Response } from 'express';
import axios, { AxiosError, AxiosResponse } from 'axios';

var router = express.Router();

interface PumpStatus {
    pump_on: boolean;
}

interface PlungeResponse {
    id?: string;
    running?: boolean;
    expected_duration?: number;
    remaining_time?: number;
    elapsed_time?: number;
    room_temp?: string;
    water_temp?: string;
    average_water_temp?: string;
    average_room_temp?: string;
}

interface OzoneStatus {
    start_time: Date;
    end_time: Date;
    running: boolean;
    status_message: string;
    expected_duration: number;
}

function buildPlungeServerURL(req: Request, path: string): string {
    const serverIP = req.app.locals.plungeServerIP as string;

    return serverIP + path;
}

router.post('/ozone', async function (req: Request, res: Response) {
    try {
        let ozoneStatus = await readOzoneStatus(req);

        if (ozoneStatus && ozoneStatus.running) {
            await axios.post(buildPlungeServerURL(req, '/v1/ozone/stop'));
        } else {
            await axios.post(buildPlungeServerURL(req, '/v1/ozone/start'));
        }
    } catch (error) {
        if (axios.isAxiosError(error)) {
            handleRequestError(error);
        } else {
            console.error('unexpected error:', error);
        }
    }
});

async function readOzoneStatus(req: Request) {
    try {
        const response = await axios.get(
            buildPlungeServerURL(req, '/v1/ozone'),
        );

        const ozoneResult: OzoneStatus = response.data;
        return ozoneResult;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            handleRequestError(error);
        } else {
            console.error('unexpected error:', error);
        }
    }
    return null;
}

router.post('/change-filter', async function (req: Request, res: Response) {
    const { date } = req.body;
    const filterDate = new Date(date);
    let d = new Date(date);
    const remindDate = new Date(d.setDate(d.getDate() + 14));

    const data = {
        changed_at: filterDate,
        remind_at: remindDate,
    };
    console.log(data);
    try {
        await axios.post(buildPlungeServerURL(req, '/v2/filers/change'), data);
    } catch (error) {
        if (axios.isAxiosError(error)) {
            handleRequestError(error);
        } else {
            console.error('unexpected error:', error);
        }
    }
});

router.get('/pump', async function (req: Request, res: Response) {
    let pumpStatus = await readPumpStatus(req);
    res.json(pumpStatus);
});

router.post('/pump', async function (req: Request, res: Response) {
    try {
        let pumpStatus = await readPumpStatus(req);

        if (pumpStatus && pumpStatus.pump_on) {
            await axios.post(buildPlungeServerURL(req, '/v1/pump/stop'));
        } else {
            await axios.post(buildPlungeServerURL(req, '/v1/pump/start'));
        }
    } catch (error) {
        if (axios.isAxiosError(error)) {
            handleRequestError(error);
        } else {
            console.error('unexpected error:', error);
        }
    }
});

router.get('/plunge', async function (req: Request, res: Response) {
    let status = await readPlungeStatus(req);
    res.json(status);
});

router.post('/plunge', async function (req: Request, res: Response) {
    let plungeStatus: PlungeResponse = {};
    try {
        plungeStatus = await readPlungeStatus(req);
        let response: AxiosResponse;
        if (plungeStatus.running) {
            response = await axios.put(
                buildPlungeServerURL(req, '/v2/plunges/stop'),
            );
        } else {
            response = await axios.post(
                buildPlungeServerURL(req, '/v2/plunges/start'),
            );
        }

        plungeStatus = response.data as PlungeResponse;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            handleRequestError(error);
        } else {
            console.error('unexpected error:', error);
        }
    }
    res.json(plungeStatus);
});

async function readPlungeStatus(req: Request) {
    let plungeResponse: PlungeResponse = {};
    try {
        const response = await axios.get(
            buildPlungeServerURL(req, '/v2/plunges/status'),
        );
        plungeResponse = response.data as PlungeResponse;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            handleRequestError(error);
        } else {
            console.error('unexpected error:', error);
        }
    }

    return plungeResponse;
}

async function readPumpStatus(req: Request) {
    try {
        const response = await axios.get(buildPlungeServerURL(req, '/v1/pump'));

        const pumpResult: PumpStatus = response.data;
        return pumpResult;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            handleRequestError(error);
        } else {
            console.error('unexpected error:', error);
        }
    }
    return null;
}

function handleRequestError(error: AxiosError) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    if (error.response) {
        console.error(
            `Error received '${error.response.status}': ${error.response.data}`,
        );
    } else if (error.request) {
        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        const httpRequest: XMLHttpRequest = error.request;
        console.error(
            `Error received '${httpRequest.statusText}': ${httpRequest.responseText}`,
        );
    } else {
        // Something happened in setting up the request that triggered an Error
        console.error('Error Message:', error.message);
    }
}

export default router;
