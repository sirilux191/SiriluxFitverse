import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import Vapi from "@vapi-ai/web";
import OpenAI from "openai";

const ConsultationPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const [isCallActive, setIsCallActive] = useState(false);
  const [vapi, setVapi] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [documentText, setDocumentText] = useState("");
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [isStartingCall, setIsStartingCall] = useState(false);
  const [callError, setCallError] = useState("");

  const processingMessages = [
    "Analyzing medical documents...",
    "Extracting health information...",
    "Processing clinical data...",
    "Preparing for consultation...",
  ];

  useEffect(() => {
    const vapiInstance = new Vapi(process.env.VAPI_BOT_KEY);

    vapiInstance.on("call-start", () => {
      setIsCallActive(true);
      setCallError("");
    });

    vapiInstance.on("call-end", () => {
      setIsCallActive(false);
      setIsStartingCall(false);
    });

    vapiInstance.on("error", (error) => {
      console.error("Vapi error:", error);
      setIsCallActive(false);
      setIsStartingCall(false);

      // Handle specific error cases
      if (
        error.error?.type === "no-room" ||
        error.errorMsg === "Meeting has ended"
      ) {
        setCallError(
          "The consultation session has ended. Please start a new session."
        );
      } else {
        setCallError(
          "An error occurred during the consultation. Please try again."
        );
      }
    });

    setVapi(vapiInstance);

    return () => {
      if (vapiInstance) vapiInstance.stop();
    };
  }, []);

  const processDocument = async (file) => {
    setIsProcessing(true);
    setProcessingProgress(0);

    // Add file size check
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      setUploadStatus("File too large. Please upload an image under 10MB.");
      setIsProcessing(false);
      return;
    }

    // Compress image before processing
    const compressedImage = await compressImage(file);
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      dangerouslyAllowBrowser: true,
    });

    try {
      const progressInterval = setInterval(() => {
        setProcessingProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 500);

      const imageBase64 = await convertImageToBase64(compressedImage);
      const base64Data = imageBase64.split(",")[1];

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Please extract all the text from this document.",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Data}`,
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
      });

      clearInterval(progressInterval);
      setProcessingProgress(100);
      setDocumentText(response.choices[0].message.content);
      setUploadStatus("Document processed successfully!");
    } catch (error) {
      console.error("Error processing document:", error);
      setUploadStatus("Error processing document");
      setProcessingProgress(0);
    } finally {
      setIsProcessing(false);
    }
  };

  const convertImageToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 1200;
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;

          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          canvas.toBlob(
            (blob) => {
              resolve(
                new File([blob], file.name, {
                  type: "image/jpeg",
                })
              );
            },
            "image/jpeg",
            0.7
          );
        };
      };
    });
  };

  const handleFileUpload = async (event) => {
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    await processDocument(selectedFile);
  };

  const startDiscussion = async () => {
    setIsStartingCall(true);
    try {
      await vapi.start({
        model: {
          provider: "openai",
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are a medical smart assistant who helps discuss the following document: ${documentText}. 
                       Use this information to answer user queries accurately.`,
            },
          ],
        },
        transcriber: {
          provider: "deepgram",
          model: "nova-2",
          smartFormat: false,
          endpointing: 10,
        },
        voice: {
          provider: "smallest-ai",
          voiceId: "deepika",
        },
        name: "Document Discussion Assistant",
      });
    } catch (error) {
      console.error("Failed to start session:", error);
      setUploadStatus("Failed to start consultation. Please try again.");
    } finally {
      setIsStartingCall(false);
    }
  };

  const endMeditation = () => {
    if (vapi) {
      vapi.stop();
    }
    setIsCallActive(false);
    setIsStartingCall(false);
    setProcessingProgress(0);
    setUploadStatus("");
    setFile(null);
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center mb-6">
        <Button
          variant="ghost"
          className="p-2 hover:bg-gray-800"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="ml-2">Back</span>
        </Button>
      </div>

      <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-800 p-6 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-white mb-6">
          AI Medical Consultation
        </h2>

        <div className="space-y-6">
          {callError && (
            <div className="bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-lg mb-4">
              <p>{callError}</p>
            </div>
          )}

          <div className="bg-gray-800 p-6 rounded-lg">
            <h3 className="text-xl text-white mb-4">
              Upload Medical Documents
            </h3>
            <div className="space-y-4">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={isProcessing}
                className="block w-full text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-700 file:text-white hover:file:bg-gray-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              />

              {file && (
                <div className="mt-4">
                  <img
                    src={URL.createObjectURL(file)}
                    alt="Uploaded document"
                    className="max-w-md rounded-lg shadow-lg mx-auto object-contain max-h-96"
                  />
                </div>
              )}

              {isProcessing && (
                <div className="mt-4">
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300 ease-in-out"
                      style={{ width: `${processingProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-gray-400 mt-2 flex items-center">
                    {
                      processingMessages[
                        Math.floor(
                          (processingProgress / 100) * processingMessages.length
                        )
                      ]
                    }
                    <svg
                      className="animate-spin ml-2 h-4 w-4"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  </p>
                </div>
              )}

              {uploadStatus && !isProcessing && (
                <p
                  className={`mt-2 ${
                    uploadStatus.includes("Error")
                      ? "text-red-400"
                      : "text-green-400"
                  }`}
                >
                  {uploadStatus}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-center">
            <Button
              onClick={isCallActive ? endMeditation : startDiscussion}
              disabled={!documentText || isProcessing || isStartingCall}
              className={`px-6 py-3 text-lg font-semibold rounded-full transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
                isCallActive
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {isStartingCall ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin h-5 w-5 mr-2"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Initializing...
                </span>
              ) : isCallActive ? (
                "End Consultation"
              ) : (
                "Start Consultation"
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ConsultationPage;
