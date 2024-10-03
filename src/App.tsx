import React, {useState} from 'react';
import './App.css';
import {fromB64} from "@mysten/sui/utils";
import {Ed25519Keypair} from "@mysten/sui/keypairs/ed25519";
import {Transaction} from "@mysten/sui/transactions";
import {getFullnodeUrl, SuiClient} from "@mysten/sui/client";
import {Signer} from "@mysten/sui/cryptography"
import {SUI_CLOCK_OBJECT_ID} from "@mysten/sui/utils";

import { bcs } from "@mysten/sui/bcs";


//@ts-ignore
import {execHaloCmdWeb} from "@arx-research/libhalo/api/web.js";

function bytesToHex(bytes: number[]): string {
  return '0x' + bytes.map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export const createMsgDigest = async (address: string, timestamp: number) => {
  console.log("address", address);
  console.log("timestamp", timestamp);

  const addr_bytes = bcs.Address.serialize(address);
  const ts_bytes = bcs.ser("u64", timestamp).toBytes();
  const msgToDigest = new Uint8Array(addr_bytes.length + ts_bytes.length);
  msgToDigest.set(addr_bytes);
  msgToDigest.set(ts_bytes, addr_bytes.length);
  const msgDigestHex = uint8array2hex(sha256(msgToDigest));

  return [msgDigestHex, timestamp];
};

 const readTheCorrectPublicKey = async (
    publicKeyDigest: string,
    signatureDigest: string
) => {
  let pkey = Array.from(Buffer.from(publicKeyDigest, "hex"));
  pkey.shift();
  pkey = pkey.slice(0, 32);
  //depends on last byte, unshift 2 or 3 to sub with last number to be even
  if (pkey[pkey.length - 1] % 2 == 0) {
    pkey.unshift(2);
  } else {
    pkey.unshift(3);
  }
  const pkey_final = Uint8Array.from(pkey);
  const signature_final = Uint8Array.from(Buffer.from(signatureDigest, "hex"));
  return [pkey_final, signature_final];
};


function compressPublicKeyToUint8Array(hex: string): Uint8Array {
  // Convert hex string to byte array
  const uncompressedKey = hexToBytes(hex);

  // Ensure the key starts with 0x04 (uncompressed format)
  if (uncompressedKey[0] !== 0x04) {
    throw new Error("Not a valid uncompressed public key");
  }

  // Extract x and y coordinates
  const xCoord = uncompressedKey.slice(1, 33);  // First 32 bytes (after 0x04) is x-coordinate
  const yCoord = uncompressedKey.slice(33);     // Next 32 bytes is y-coordinate

  // Determine if y-coordinate is even or odd
  const prefix = (yCoord[yCoord.length - 1] % 2 === 0) ? 0x02 : 0x03;

  // Construct the compressed public key
  const compressedKey = new Uint8Array(33);
  compressedKey[0] = prefix; // Prefix (0x02 or 0x03)
  compressedKey.set(xCoord, 1); // Set x-coordinate

  return compressedKey;
}

// Helper function: Converts a hex string to a byte array (Uint8Array)
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}


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
    target: `${packageID}::pbt::mint`,
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
  const [publickKey, setPublickKey] = useState(new Uint8Array([]));
  const [stateSignature, setStateSignature] = useState(new Uint8Array([]));

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
      digest: bytesToHex(Array.from(messageToSign))
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

      let signature = res.signature.raw.r + res.signature.raw.s
     setStateSignature(hexToBytes(signature))

      const compressedKey = compressPublicKeyToUint8Array(res.publicKey);
      setPublickKey(compressedKey)

      let [, sig_final] = await readTheCorrectPublicKey(
          res.publicKey,
          res.signature.raw.r + res.signature.raw.s
      );

      const mintRes = await pbt_mint(
          hexToBytes(signature),
          compressedKey,
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
        <>{publickKey}</>
        <p>siganture {stateSignature}</p>
      </div>
  );
}

export default App;