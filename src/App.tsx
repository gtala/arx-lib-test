import React, {useState} from 'react';
import './App.css';
import {fromB64} from "@mysten/sui/utils";
import {Ed25519Keypair} from "@mysten/sui/keypairs/ed25519";
import {Transaction} from "@mysten/sui/transactions";
import {getFullnodeUrl, SuiClient} from "@mysten/sui/client";
import {SUI_CLOCK_OBJECT_ID} from "@mysten/sui/utils";
//@ts-ignore
import {execHaloCmdWeb} from "@arx-research/libhalo/api/web.js";

const mySuiClient = new SuiClient({url: getFullnodeUrl("testnet")});
const PBT_PACKAGE_ID = '0x874bb249c4119df5de655c982b4d4eefdb2bba9f4a807ad29ff0a19914b47a42'//'0x30da050ef8a0959023b2d5d25ff7a67c036745253c923d5e8361af2b717f6aa5'

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
        digest: ''
      }, haloOptions);

      let [pkey_final, signature_final] = await readTheCorrectPublicKey(
          scannedResult.publicKey,
          scannedResult.signature.raw.r + scannedResult.signature.raw.s
      );

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

export default App;