import React, { useState} from 'react';
import './App.css';

import QRCodeComponent from "./QRCodeComponent";

interface ArgsResponse {
    address: string;
    digest: string
}

function App() {

    const [statusText, setStatusText] = useState('Click on the button');
    const [inputValue, setInputValue] = useState<string>('');
    const [argsState, setArgsState] = useState<ArgsResponse>({} as ArgsResponse);

    const getArgs = async (): Promise<ArgsResponse | undefined> => {
        try {
            const response = await fetch(`${inputValue}/version/args`);

            // Check if the response is OK
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            // Parse and return the JSON response
            const data: ArgsResponse = await response.json();
            console.log('Version Data:', data);
            return data;
        } catch (error) {
            console.error('Error fetching ArgsResponse data:', error);
        }
    };

    const sendResult = async (body: any): Promise<ArgsResponse | undefined> => {
        try {
            const response = await fetch(`${inputValue}/version/callcontract`, {
                method: 'POST', // Specify the request method
                headers: {
                    'Content-Type': 'application/json', // Specify the content type
                },
                body: JSON.stringify(body),
            });

            // Check if the response is OK
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            // Parse and return the JSON response
            const data: ArgsResponse = await response.json();
            console.log('Version Data:', data);
            return data;
        } catch (error) {
            console.error('Error fetching ArgsResponse data:', error);
        }
    };

    async function btnReadChipAndMintPBT() {
        setArgsState((await getArgs())!)
    }

    return (
        <div className="App">
            <QRCodeComponent

                address={argsState?.address!}
                commands={[{
                            name: "sign",
                            keyNo: 1,
                            digest: argsState?.digest!
                }]}
                onScanComplete={(result) => {
                    sendResult(result.chipScanResult)
            }} show></QRCodeComponent>

            <pre style={{fontSize: 12, textAlign: "left", whiteSpace: "pre-wrap", wordWrap: "break-word"}}>
                {statusText}
            </pre>
            <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Enter your input"
            />
            <button onClick={() => btnReadChipAndMintPBT()}>Sign message using key #1</button>
        </div>
    );
}


export default App;