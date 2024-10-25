import React, { useState} from 'react';
import './App.css';

import QRCodeComponent from "./QRCodeComponent";
import {Command, createMsgDigest} from "./helpers/qrHelper";
import {getUserData, VerifySignature} from "./helpers/verificationContract";

interface ArgsResponse {
    address: string;
    digest: string
}

function App() {

    const [statusText, setStatusText] = useState('Click on the button');
    const [inputValue, setInputValue] = useState<string>('');
    const [argsState, setArgsState] = useState<ArgsResponse>({} as ArgsResponse);
    const [command, setCommand] = useState<Command>({} as Command)


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
        //for server side contract call only
        //const args = await getArgs()

        const {
            userKeypair,
            address
        } =  getUserData()

        //1. For creating the msgDigest, use this (just ignore the timestamp and create the message with the address):
        const [msgDigestHex, ] = await createMsgDigest(
            address!,
            Date.now()
        );

        //2. Then, manage the results like this:
        const myCommand = {
            name: "sign",
            keyNo: 1,
            digest: msgDigestHex.toString(),
        };

        setCommand(myCommand)
    }

    return (
        <div className="App">
            <QRCodeComponent
                address={argsState?.address!}
                commands={[command]}
                onScanComplete={(result) => {
                    //only for backend call
                    sendResult(JSON.parse(result.chipScanResult))
                    console.log("onScanComplete", result)
                    VerifySignature(result.sig_final, result.pkey_final)
            }} show></QRCodeComponent>

            <pre style={{fontSize: 12, textAlign: "left", whiteSpace: "pre-wrap", wordWrap: "break-word"}}>
                {statusText}
            </pre>
           {/* for server side contract call only */}
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