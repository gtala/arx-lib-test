import React, {useState} from 'react';
import './App.css';
import {fromB64} from "@mysten/sui/utils";
import {Ed25519Keypair} from "@mysten/sui/keypairs/ed25519";
import {Transaction} from "@mysten/sui/transactions";
import {getFullnodeUrl, SuiClient} from "@mysten/sui/client";
import {Signer} from "@mysten/sui/cryptography"
import {SUI_CLOCK_OBJECT_ID} from "@mysten/sui/utils";

import { bcs } from "@mysten/sui/bcs";
import { sha256 } from "@noble/hashes/sha256";

//@ts-ignore
import {execHaloCmdWeb} from "@arx-research/libhalo/api/web.js";

const mySuiClient = new SuiClient({url: getFullnodeUrl("testnet")});
const PBT_PACKAGE_ID = '0xde0bd3ebe2439cf58edb190d150c6d31df30056953f437c96965e830a8c23cc1'//'0x30da050ef8a0959023b2d5d25ff7a67c036745253c923d5e8361af2b717f6aa5'
const ARCHIVE_OBJECT_ID = '0x44f652dcd235d0a29a8231c3a57459580812022fdc0e5a0bdb0af9e8d85c5a9d'//"0x57e282bb30b2410983d6c16d6dbdeb661f203e0cd2a480a57aedfbf81f551d78"


function uint8array2hex(uint8array: Uint8Array): string {
  return Buffer.from(uint8array).toString("hex");
}
const buildMessageToSign =  async (address: string) => {

  const addr_bytes = bcs.Address.serialize(address).toBytes()
  const msgToDigest = new Uint8Array(addr_bytes.length);
  msgToDigest.set(addr_bytes);
  return uint8array2hex(sha256(msgToDigest));
};

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

const getLatestDRANDBeaconValue = async () => {
  const response = await fetch("https://api.drand.sh/public/latest");

  // Check if the response is ok (status code in the range 200-299)
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json(); // Parse the JSON from the response
  return data;
};

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

const pbt_mint = async (
    chipSignature: Uint8Array,
    chipPK: Uint8Array,
    keyPair: Signer,
) => {
  // Get the latest DRAND beacon value
  const drandBeaconValue = await getLatestDRANDBeaconValue();

  // Get the bytes from the DRAND signature.
  let drandSignatureBytes: Uint8Array = new Uint8Array(
      Buffer.from(drandBeaconValue.signature, "hex"),
  );

  // Get the bytes for the previous DRAND signature.
  let drandPreviousSignatureBytes: Uint8Array = new Uint8Array(
      Buffer.from(drandBeaconValue.previous_signature, "hex"),
  );

  const tx = new Transaction();
  tx.setGasBudget(100000000);
  tx.moveCall({
    target: `${PBT_PACKAGE_ID}::pbt::mint`,
    arguments: [
      tx.pure.vector("u8", Array.from(chipSignature)),
      tx.pure.vector("u8", Array.from(chipPK)),
      tx.pure.vector("u8", Array.from(drandSignatureBytes)),
      tx.pure.vector("u8", Array.from(drandPreviousSignatureBytes)),
      tx.pure.u64(drandBeaconValue.round),
      tx.object(ARCHIVE_OBJECT_ID),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });

  const response = await mySuiClient.signAndExecuteTransaction({
    signer: keyPair,
    transaction: tx,
    requestType: "WaitForLocalExecution",
    options: {
      showEffects: true,
      showEvents: true,
      showObjectChanges: true,
    },
  });
  return response;
};


function App() {
  const [statusText, setStatusText] = useState('Click on the button');

  async function btnReadChipAndMintPBT() {

    //1) create signer KeyPair
    const {userKeypair, userAddress} = getUserKeyPairData();

    let res;

    try {
      // 2) Get signed message
      res = await execHaloCmdWeb({
        name: "sign",
        keyNo: 1,
        digest: await buildMessageToSign(userAddress)
      }, {
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

    // 3) format signed message and pk
      let [pkey_final, signature_final] = await readTheCorrectPublicKey(
          res.publicKey,
          res.signature.raw.r + res.signature.raw.s
      );

      console.log(pkey_final, signature_final)


      const tx = new Transaction();
      tx.setGasBudget(1000000);
      tx.moveCall({
        target: `${PBT_PACKAGE_ID}::merch::prove_physical_ownership`,
        arguments: [
          tx.pure.vector("u8", Array.from(pkey_final)),
          tx.pure.vector("u8", Array.from(signature_final)),
          tx.pure.u64(Date.now()),
          tx.object(SUI_CLOCK_OBJECT_ID),
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



      /*      // 4) Call Mint PBT function
            const mintRes = await pbt_mint(
                signature_final,
                pkey_final,
                userKeypair,
            );

            console.log("mintRes", mintRes.digest)*/

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
        <button onClick={() => btnReadChipAndMintPBT()}>Sign message using key #1</button>
      </div>
  );
}

export default App;