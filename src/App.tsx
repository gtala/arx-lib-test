import React, {useEffect, useState} from 'react';
import './App.css';
import {fromB64} from "@mysten/sui/utils";
import {Ed25519Keypair} from "@mysten/sui/keypairs/ed25519";
import {Transaction} from "@mysten/sui/transactions";
import {getFullnodeUrl, SuiClient} from "@mysten/sui/client";
import {SUI_CLOCK_OBJECT_ID} from "@mysten/sui/utils";
//@ts-ignore
import {execHaloCmdWeb} from "@arx-research/libhalo/api/web.js";
import { sha256 } from "@noble/hashes/sha256";
import { bcs } from "@mysten/sui/bcs";
import {readTheCorrectPublicKey} from "./helpers/readResultFromChip";
import QRCodeComponent from "./QRCodeComponent";


interface VersionResponse {
  version: string; // Adjust based on the actual API response structure
}

const getVersionData = async (): Promise<VersionResponse | undefined> => {
  try {
    const response = await fetch('https://4994-152-171-119-6.ngrok-free.app/version');

    // Check if the response is OK
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    // Parse and return the JSON response
    const data: VersionResponse = await response.json();
    console.log('Version Data:', data);
    return data;
  } catch (error) {
    console.error('Error fetching version data:', error);
  }
};

const mapScannedMessage = new Map<string,string>([
    ["init", "Please tap the tag to the back of your smartphone and hold it..."],
    ["retry", "Something went wrong, please try to tap the tag again..."],
    ["scanned", "Tag scanned successfully, post-processing the result..."]
    ])

const mySuiClient = new SuiClient({url: getFullnodeUrl("testnet")});
const PBT_PACKAGE_ID = '0x62c999921b5aa9232e80b4d3e13137e8fb7593a2d0a8d27c1b2928d3ae2196dc'//'0x30da050ef8a0959023b2d5d25ff7a67c036745253c923d5e8361af2b717f6aa5'

function App() {


  useEffect(() => {
    getVersionData()
  }, []);
  const {userKeypair, userAddress} = getUserKeyPairData();


  const [statusText, setStatusText] = useState('Click on the button');

  const haloOptions = {
    statusCallback: (cause: string) => {
      const status = mapScannedMessage.get(cause)
      setStatusText(status ? status : cause);
    }
  }

  async function btnReadChipAndMintPBT() {

    let scannedResult;

    const digestMessage = createMsgDigest(userAddress)

    try {
      scannedResult = await execHaloCmdWeb({
        name: "sign",
        keyNo: 1,
        digest: digestMessage
      }, haloOptions);

      let [pkey_final, signature_final] = await readTheCorrectPublicKey(
          scannedResult.publicKey,
          scannedResult.signature.raw.r + scannedResult.signature.raw.s
      );

      const tx = new Transaction();
      tx.setGasBudget(2000000);
      tx.moveCall({
        target:`${PBT_PACKAGE_ID}::signature::verify_signature_v2`,
        arguments: [
          tx.pure.vector("u8", signature_final),
          tx.pure.vector("u8",  pkey_final),
          tx.pure.vector("u8", bcs.Address.serialize(userAddress).toBytes()),
        ],
      });
      const response = await mySuiClient.signAndExecuteTransaction({
        signer: userKeypair,
        transaction: tx,
        requestType: "WaitForLocalExecution",
        options: {
          showEffects: true,
          showEvents: true,
          showObjectChanges: true,
        },
      });

      console.log(response.digest)
      setStatusText(JSON.stringify(scannedResult, null, 4));
    } catch (e) {
      setStatusText('Scanning failed, click on the button again to retry. Details: ' + String(e));
    }
  }


  const digestMessage = createMsgDigest(userAddress)

  return (
      <div className="App">
        <QRCodeComponent address={userAddress} commands={[{
          name: "sign",
          keyNo: 1,
          digest: digestMessage
        }]} onScanComplete={(result)=>{ console.log(result)}}  show></QRCodeComponent>
      {/*      <pre style={{fontSize: 12, textAlign: "left", whiteSpace: "pre-wrap", wordWrap: "break-word"}}>
                {statusText}
            </pre>
        <button onClick={() => btnReadChipAndMintPBT()}>Sign message using key #1</button>*/}
      </div>
  );
}

function getUserKeyPairData() {
  let userPrivateKeyArray = new Array<number>();
  userPrivateKeyArray = Array.from(fromB64("AHvhK7acqcgXdkSR+gE5jzTFXjvWvH7hdYOesk/MR+07"));
  userPrivateKeyArray.shift(); // remove the first byte
  const userKeypair = Ed25519Keypair.fromSecretKey(
      Uint8Array.from(userPrivateKeyArray),
  );
  const userAddress = userKeypair.getPublicKey().toSuiAddress();
  console.log("userAddress", userAddress)
  return {userKeypair, userAddress};
}

export const createMsgDigest =  (address: string) => {
  const addr_bytes = bcs.Address.serialize(address).toBytes();
  const msgToDigest = new Uint8Array(addr_bytes.length);
  msgToDigest.set(addr_bytes);
  const msgDigestHex = uint8array2hex(sha256(msgToDigest));

  return msgDigestHex
};

function uint8array2hex(uint8array: Uint8Array): string {
  return Buffer.from(uint8array).toString("hex");
}


export default App;