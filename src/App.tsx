import React, {useState} from 'react';
import './App.css';
//@ts-ignore
import {execHaloCmdWeb} from "@arx-research/libhalo/api/web.js";

const hexToUint8Array = (hex: any) => {
  let bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  return new Uint8Array(bytes);
};

const uncompressToUint8 = (uncompressedPubKey: string)=> {

  const xCoord = uncompressedPubKey.slice(0, 64);  // First 64 hex characters (32 bytes)
  const yCoord = uncompressedPubKey.slice(64);     // Remaining 64 hex characters (32 bytes)
  const yBigInt = BigInt("0x" + yCoord);
  // @ts-ignore
  const isEven = (yBigInt % 2n === 0n);
  const prefix = isEven ? "02" : "03";
  const compressedPubKey = prefix + xCoord;

  console.log("Compressed Public Key:", compressedPubKey);
  return  hexToUint8Array(compressedPubKey);
}

const getLatestDRANDBeaconValue = async () => {
  const response = await fetch("https://api.drand.sh/public/latest");

  // Check if the response is ok (status code in the range 200-299)
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json(); // Parse the JSON from the response
  return data;
};

const generateSignature = async (
) => {
  const msgToSign: Array<Uint8Array> = [];
  let addressBytes: Uint8Array = new Uint8Array(
      Buffer.from("0xd2ad255a4a6d454ecb2f407f1fd7887bf623eac7ba935be25eceb7eda10bce06".slice(2), "hex"),
  );
  //msgToSign.push(addressBytes);
  console.log("addressBytes", addressBytes)

  const drandData = await getLatestDRANDBeaconValue();
  const drandSignatureBytes: Uint8Array = new Uint8Array(
      Buffer.from(drandData.signature, "hex"),
  );
  // msgToSign.push(drandSignatureBytes);
  console.log("drandSignatureBytes", drandSignatureBytes)
  return { drandSignatureBytes, addressBytes}
};

function App() {
  const [statusText, setStatusText] = useState('Click on the button');
  const [dataAdddess, setDataAddress] = useState(new Uint8Array([]));
  const [dataDrand, setDataDrand] = useState(new Uint8Array([]));

  async function btnClick() {
    const data  = await generateSignature()
    let msgToSignBytes: Uint8Array = new Uint8Array();
    //@ts-ignore
    msgToSignBytes = Uint8Array.from([...msgToSignBytes, ...data.addressBytes]);
    //@ts-ignore
    msgToSignBytes = Uint8Array.from([...msgToSignBytes, ...data.drandSignatureBytes]);

    let command = {
      name: "sign",
      keyNo: 1,
      message: msgToSignBytes
    };

    setDataAddress(data.addressBytes)
    setDataDrand(data.drandSignatureBytes)

    let res;

    try {
      // --- request NFC command execution ---
      res = await execHaloCmdWeb(command, {
        statusCallback: (cause: any) => {
          if (cause === "init") {
            setStatusText("Please tap the tag to the back of your smartphone and hold it...");
          } else if (cause === "retry") {
            setStatusText("Something went wrong, please try to tap the tag again...");
          } else if (cause === "scanned") {
            setStatusText("Tag scanned successfully, post-processing the result...");
          } else {
            setStatusText(cause);
          }
        }
      });
      // the command has succeeded, display the result to the user
      setStatusText(JSON.stringify(res, null, 4));
    } catch (e) {
      // the command has failed, display error to the user
      setStatusText('Scanning failed, click on the button again to retry. Details: ' + String(e));
    }
  }

  return (
      <div className="App">
            <pre style={{fontSize: 12, textAlign: "left", whiteSpace: "pre-wrap", wordWrap: "break-word"}}>
                {statusText}
            </pre>
        <button onClick={() => btnClick()}>Sign message 010203 using key #1</button>
        <p>{dataAdddess}</p>
        <p>{dataDrand}</p>
      </div>
  );
}

export default App;