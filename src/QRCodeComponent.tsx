import React, { useEffect, useState } from "react";
//@ts-ignore
import { execHaloCmdWeb } from "@arx-research/libhalo/api/web";
import {readTheCorrectPublicKey} from "./helpers/readResultFromChip";
import {Command, getSignatureAsUint8Array} from "./helpers/qrHelper";

interface QRCodeComponentProps {
  address: string;
  commands: Command[];
  onScanComplete: (result: any) => void;
  show?: boolean;
  onClose?: () => void;
}

const QRCodeComponent: React.FC<QRCodeComponentProps> = ({
                                                           address,
                                                           commands,
                                                           onScanComplete,
                                                           show,
                                                           onClose,
                                                         }) => {
  const [scanResult, setScanResult] = useState<any>(null);

  const [publicKey, setPublicKey] = useState("");
  const [signature, setSignature] = useState("");
  const [publicKeyFinal, setPublicKeyFinal] = useState(new Uint8Array());
  const [signatureFinal, setSignatureFinal] = useState(new Uint8Array());
  const [chipScanResult, setChipScanResult] = useState();

  const final_pkey_and_sig =  () => {
    let [pkey_final, sig_final] =  readTheCorrectPublicKey(
        publicKey,
        signature
    );

    return [pkey_final, sig_final]

  };

  const executeHaLoCommands = async () => {
    try {
      // await gate.waitConnected();
      for (let cmd of commands) {
        // let res = await gate.execHaloCmd(cmd);
        const res = await execHaloCmdWeb(cmd);
        setChipScanResult(res)
        console.log("res", res)

        let signature = await getSignatureAsUint8Array(
            res.signature.raw.r,
            res.signature.raw.s,
            res.signature.raw.v
        );

        console.log("signature", signature)
        setPublicKey(res.publicKey);
        setSignature(res.signature.raw.r + res.signature.raw.s);
        setScanResult({
          publicKey: res.publicKey,
          signature: res.signature.raw.r + res.signature.raw.s,
        });
      }
      console.log("Commands executed successfully!");
    } catch (e) {
      console.error("Error executing HaloGateway commands", e);
    }
  };

  useEffect(() => {
    console.log({ address, commands });

    if(commands.length > 0)
    executeHaLoCommands();
  }, [address, JSON.stringify(commands)]);

  useEffect(() => {
    if (scanResult) {
      let [pkey_final, sig_final]  = final_pkey_and_sig();
      onScanComplete({chipScanResult, scanResult,  pkey_final, sig_final}); // Call the callback when scanResult is set
      setPublicKeyFinal(pkey_final);
      setSignatureFinal(sig_final);
    }
  }, [scanResult]);

  if (!show) {
    return null;
  }

  return (
      <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center">
        <div className="bg-white p-6 rounded-md shadow-lg max-w-md w-full">
          {scanResult && (
              <div>
                <p>Public Key: {publicKeyFinal.toString()}</p>
                <p>Signature: {signatureFinal}</p>
              </div>
          )}
          <button
              onClick={onClose}
              className="mt-4 w-full bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
          >
            Close
          </button>
        </div>
      </div>
  );
};

export default QRCodeComponent;