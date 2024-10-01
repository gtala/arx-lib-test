import React, {useState} from 'react';
import './App.css';
import {fromB64} from "@mysten/sui/utils";
import {Ed25519Keypair} from "@mysten/sui/keypairs/ed25519";
import {Transaction} from "@mysten/sui/transactions";
import {getFullnodeUrl, SuiClient} from "@mysten/sui/client";
import {Signer} from "@mysten/sui/cryptography"
import {SUI_CLOCK_OBJECT_ID} from "@mysten/sui/utils";



//@ts-ignore
import {execHaloCmdWeb} from "@arx-research/libhalo/api/web.js";


export const getSignatureAsUint8Array = async (
    r: string,
    s: string,
    v: number
) => {
  // Convert r, s values to Uint8Array
  const rBytes = Uint8Array.from(Buffer.from(r, "hex"));
  const sBytes = Uint8Array.from(Buffer.from(s, "hex"));
  const vByte = Uint8Array.from([v]);
  // @ts-ignore
  const signature = new Uint8Array([...rBytes, ...sBytes, ...vByte]);

  return signature;
};

export const mySuiClient = new SuiClient({url: getFullnodeUrl("testnet")});
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

const getMessageToSign = async (
    address: string,
    extra_byte: boolean,
) => {
  console.log("address", address);
  let msgToSign: Array<Uint8Array> = [];
  let addressBytes: Uint8Array = new Uint8Array(
      Buffer.from(address.slice(2), "hex"),
  );
  msgToSign.push(addressBytes);

  const drandData = await getLatestDRANDBeaconValue();
  console.log("drandData.signature", drandData.signature)
  let drandSignatureBytes: Uint8Array = new Uint8Array(
      Buffer.from(drandData.signature, "hex"),
  );
  msgToSign.push(drandSignatureBytes);
  let msgToSignBytes: Uint8Array = new Uint8Array();
  msgToSign.forEach((msg) => {
    //@ts-ignore
    msgToSignBytes = Uint8Array.from([...msgToSignBytes, ...msg]);
  });
  if (extra_byte) {
    //@ts-ignore
    msgToSignBytes = new Uint8Array([...msgToSignBytes, 0]);
  }

  return msgToSignBytes;
};

const packageID = '0x30da050ef8a0959023b2d5d25ff7a67c036745253c923d5e8361af2b717f6aa5'
const adminCap = "0xe6016206b1177cb44c1467a4aa43dc0e8838b8030dc03ca501c281895ced8d58"
const pbtArchive = "0x57e282bb30b2410983d6c16d6dbdeb661f203e0cd2a480a57aedfbf81f551d78"



export const pbt_mint = async (
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
    target: `${packageID}::pbt::pbt`,
    arguments: [
      tx.pure.vector("u8", Array.from(chipSignature)),
      tx.pure.vector("u8", Array.from(chipPK)),
      tx.pure.vector("u8", Array.from(drandSignatureBytes)),
      tx.pure.vector("u8", Array.from(drandPreviousSignatureBytes)),
      tx.pure.u64(drandBeaconValue.round),
      tx.object(pbtArchive),
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
  const [dataAdddess, setDataAddress] = useState(new Uint8Array([]));
  const [dataDrand, setDataDrand] = useState(new Uint8Array([]));

  async function btnClick() {
    let userPrivateKeyArray = new Array<number>();
    userPrivateKeyArray = Array.from(fromB64("AHvhK7acqcgXdkSR+gE5jzTFXjvWvH7hdYOesk/MR+07"));
    userPrivateKeyArray.shift(); // remove the first byte

    const userKeypair = Ed25519Keypair.fromSecretKey(
        Uint8Array.from(userPrivateKeyArray),
    );
    const userAddress = userKeypair.getPublicKey().toSuiAddress();

    console.log("userAddress", userAddress)


    const messageToSign  = await getMessageToSign(userAddress, false )

    let command = {
      name: "sign",
      keyNo: 1,
      message: messageToSign
    };

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

      let signature = await getSignatureAsUint8Array(
          res.signature.raw.r,
          res.signature.raw.s,
          res.signature.raw.v
      );

      console.log("signature", signature)

      const mintRes = await pbt_mint(
          signature,
          res.publicKey,
          userKeypair,
      );

      console.log("mintRes", mintRes.digest)

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