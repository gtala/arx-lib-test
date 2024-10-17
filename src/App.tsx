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
import { bcs } from "@mysten/sui/bcs";

const mapScannedMessage = new Map<string,string>([
    ["init", "Please tap the tag to the back of your smartphone and hold it..."],
    ["retry", "Something went wrong, please try to tap the tag again..."],
    ["scanned", "Tag scanned successfully, post-processing the result..."]
    ])

const mySuiClient = new SuiClient({url: getFullnodeUrl("testnet")});
const PBT_PACKAGE_ID = '0xcdb598fa18496f01295b53c711f19b756de8f813368de6054c7f55ae061f603e'//'0x30da050ef8a0959023b2d5d25ff7a67c036745253c923d5e8361af2b717f6aa5'
const message = '0x1e41bacaef7d6a7c1c82b1077d9833bda6d9427012ab4825bb2d129823432908'

function App() {

  const [statusText, setStatusText] = useState('Click on the button');

  const haloOptions = {
    statusCallback: (cause: string) => {
      const status = mapScannedMessage.get(cause)
      setStatusText(status ? status : cause);
    }
  }

  async function btnReadChipAndMintPBT() {

    //1) create signer KeyPair
    const {userKeypair, userAddress} = getUserKeyPairData();
    let scannedResult;

    const digestMessage = createMsgDigestV2(message)

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

      console.log("all", signature_final, pkey_final, digestMessage)
      const addr_bytes = bcs.Address.serialize(message).toBytes();

      const tx = new Transaction();
      tx.setGasBudget(2000000);
      tx.moveCall({
        target:`${PBT_PACKAGE_ID}::signature::verify_signature_v2`,
        arguments: [
          tx.pure.vector("u8", signature_final),
          tx.pure.vector("u8", pkey_final),
          tx.pure.vector("u8", addr_bytes),
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

export const readTheCorrectPublicKey = async (
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

export const createMsgDigestV2 =  (address: string) => {
  console.log("address", address);
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