import React, {useState} from 'react';
import './App.css';
import {fromB64} from "@mysten/sui/utils";
import {Ed25519Keypair} from "@mysten/sui/keypairs/ed25519";
import {Transaction} from "@mysten/sui/transactions";
import {getFullnodeUrl, SuiClient} from "@mysten/sui/client";
import {SUI_CLOCK_OBJECT_ID} from "@mysten/sui/utils";
//@ts-ignore
import {execHaloCmdWeb} from "@arx-research/libhalo/api/web.js";
import { sha256 } from "@noble/hashes/sha256";


const mySuiClient = new SuiClient({url: getFullnodeUrl("testnet")});
const PBT_PACKAGE_ID = '0xcdb598fa18496f01295b53c711f19b756de8f813368de6054c7f55ae061f603e'//'0x30da050ef8a0959023b2d5d25ff7a67c036745253c923d5e8361af2b717f6aa5'
const message = 'bcf83051a4d206c6e43d7eaa4c75429737ac0d5ee08ee68430443bd815e6ac05'
function App() {
  const [statusText, setStatusText] = useState('Click on the button');

  const haloOptions = {
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
  }

  async function btnReadChipAndMintPBT() {

    //1) create signer KeyPair
    const {userKeypair, userAddress} = getUserKeyPairData();
    let scannedResult;


    try {
      scannedResult = await execHaloCmdWeb({
        name: "sign",
        keyNo: 1,
        digest: createMsgDigest(message)
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
         // tx.pure.vector("u8", Array.from(Buffer.from("6a4727823b14b210a22d7a41da2b484e7aab5d89af3a4b8e99cda3feed5dd7915e212be7ab47e40b843387e61b95dbfb26c6f8c5e2301d78a8d9172ad55a52aa", "hex"))),
         // tx.pure.vector("u8", Array.from(Buffer.from("029bef8d556d80e43ae7e0becb3a7e6838b95defe45896ed6075bb9035d06c9964", "hex"))),

          tx.pure.vector("u8", signature_final),
          tx.pure.vector("u8", pkey_final),
          tx.pure.vector("u8", Array.from(Buffer.from(message, "hex"))),
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

  return (
      <div className="App">
            <pre style={{fontSize: 12, textAlign: "left", whiteSpace: "pre-wrap", wordWrap: "break-word"}}>
                {statusText}
            </pre>
        <button onClick={() => btnReadChipAndMintPBT()}>Sign message using key #1</button>
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

const readTheCorrectPublicKey = async (
    publicKeyDigest: string,
    signatureDigest: string
) => {
  let pkey = Array.from(Buffer.from(publicKeyDigest, "hex"));
  pkey.shift();
  pkey = pkey.slice(0, 32);

  // Depending on the last byte, unshift 2 or 3 to ensure the last number is even
  if (pkey[pkey.length - 1] % 2 == 0) {
    pkey.unshift(2);
  } else {
    pkey.unshift(3);
  }

  const pkey_final = Uint8Array.from(pkey);
  const signature_final = Uint8Array.from(Buffer.from(signatureDigest, "hex"));
  return [pkey_final, signature_final];
};

export const createMsgDigest =  (message: string) => {
  const message_bytes =  Array.from(Buffer.from(message, "hex"))
  const msgToDigest = new Uint8Array(message_bytes.length);
  msgToDigest.set(message_bytes);
  const msgDigestHex = uint8array2hex(sha256(msgToDigest));

  return msgDigestHex
};

function uint8array2hex(uint8array: Uint8Array): string {
  return Buffer.from(uint8array).toString("hex");
}



export default App;