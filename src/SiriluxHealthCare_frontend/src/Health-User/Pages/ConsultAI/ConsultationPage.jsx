import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import Vapi from "@vapi-ai/web";
import useActorStore from "@/State/Actors/ActorStore";

const ConsultationPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: agentId } = useParams();
  const { aiAgentSystem } = useActorStore();

  // Get token and assistantId from location state
  const token = location.state?.token;
  const assistantId = location.state?.assistantId;

  const vapiRef = useRef(null);

  const [isCallActive, setIsCallActive] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [documentText, setDocumentText] = useState("");
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [isStartingCall, setIsStartingCall] = useState(false);
  const [callError, setCallError] = useState("");
  const [tokenError, setTokenError] = useState("");
  const [callTimer, setCallTimer] = useState(0);
  const [timerInterval, setTimerInterval] = useState(null);
  const [transcript, setTranscript] = useState([]);

  const MAX_CALL_DURATION = 10 * 60; // 10 minutes in seconds

  const processingMessages = [
    "Analyzing medical documents...",
    "Extracting health information...",
    "Processing clinical data...",
    "Preparing for consultation...",
  ];

  useEffect(() => {
    // Check if we have the required token and assistantId
    if (!token) {
      setTokenError("Consultation token not found. Please try booking again.");
    }

    if (!assistantId) {
      setTokenError((prev) =>
        prev ? `${prev} Assistant ID not found.` : "Assistant ID not found."
      );
    }

    // Set up event handlers for cleanup
    return () => {
      if (vapiRef.current) {
        vapiRef.current.stop();
      }
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [token, assistantId]);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setUploadStatus("Document selected: " + selectedFile.name);
      setDocumentText(""); // Clear previous document text

      // Convert file to base64 for processing
      const reader = new FileReader();
      reader.readAsDataURL(selectedFile);
      reader.onload = () => {
        processDocument(reader.result);
      };
      reader.onerror = (error) => {
        setUploadStatus("Error reading file: " + error);
      };
    }
  };

  const processDocument = async (imageData) => {
    setIsProcessing(true);
    setProcessingProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProcessingProgress((prev) => {
        const newProgress = prev + Math.random() * 5;
        return newProgress >= 100 ? 99 : newProgress;
      });
    }, 150);

    try {
      // Call the document processing Cloud Function
      const response = await fetch(
        "https://ocr-doc-voice-service-677477691026.asia-southeast1.run.app",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            image: imageData,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      setDocumentText(data.text);
      console.log(data.text);
      setUploadStatus("Document processed successfully!");
      setProcessingProgress(100);
    } catch (error) {
      console.error("Error processing document:", error);
      setUploadStatus("Error processing document: " + error.message);
    } finally {
      clearInterval(progressInterval);
      setIsProcessing(false);
    }
  };

  const startDiscussion = async () => {
    if (!documentText) {
      setCallError("Please process a document first");
      return;
    }

    if (!token || !assistantId) {
      setCallError("Missing token or assistant ID. Please try booking again.");
      return;
    }

    setIsStartingCall(true);
    setCallError("");

    try {
      // Call the Cloud Function to get a JWT token for Vapi
      const tokenResponse = await fetch(
        "https://vapi-jwt-token-677477691026.us-central1.run.app",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token: token,
            agentId: assistantId,
          }),
        }
      );
      console.log(tokenResponse);
      if (!tokenResponse.ok) {
        throw new Error(
          `Error: ${tokenResponse.status} ${tokenResponse.statusText}`
        );
      }

      const tokenData = await tokenResponse.json();

      // Initialize Vapi with the JWT token
      const vapi = new Vapi(tokenData.token);
      vapiRef.current = vapi;

      // Set up event listeners
      setupEventListeners();

      // Start the call using the specific assistant ID we received
      await vapiRef.current.start(assistantId, {
        recordingEnabled: true,
      });

      // Send the document text to the assistant once the call starts
      vapiRef.current.on("call-start", () => {
        // Send document text to the assistant
        vapiRef.current.send({
          type: "add-message",
          message: {
            role: "system",
            content: `The following is a medical document that has been uploaded by the user. Please analyze it and provide insights: ${documentText}`,
          },
        });
      });
    } catch (error) {
      console.error("Error starting discussion:", error);
      setCallError("Error starting discussion: " + error.message);
      setIsStartingCall(false);
    }
  };

  const setupEventListeners = () => {
    if (!vapiRef.current) return;

    // Set up event listeners
    vapiRef.current.on("call-start", (event) => {
      console.log("Call started:", event);
      setIsCallActive(true);
      setIsStartingCall(false);

      // Start timer for call duration display
      const interval = setInterval(() => {
        setCallTimer((prev) => {
          const newTime = prev + 1;
          if (newTime >= MAX_CALL_DURATION) {
            // End call when max duration is reached
            endConsultation();
          }
          return newTime;
        });
      }, 1000);

      setTimerInterval(interval);
    });

    vapiRef.current.on("call-end", () => {
      console.log("Call ended");
      setIsCallActive(false);
      clearInterval(timerInterval);
      setTimerInterval(null);
    });

    vapiRef.current.on("error", (error) => {
      console.error("Vapi error:", error);
      setCallError("Error: " + (error.message || "Unknown error occurred"));
      setIsStartingCall(false);
    });

    vapiRef.current.on("message", (message) => {
      console.log("Message received:", message);
      // Store transcript messages
      if (message.type === "transcript") {
        setTranscript((prev) => [...prev, message]);
      }
    });

    // Add speech event listeners
    vapiRef.current.on("speech-start", () => {
      console.log("Assistant started speaking");
    });

    vapiRef.current.on("speech-end", () => {
      console.log("Assistant stopped speaking");
    });

    // Add volume level event listener
    vapiRef.current.on("volume-level", (volume) => {
      console.log(`Assistant volume level: ${volume}`);
      // You can use this to visualize the assistant's speech volume
    });
  };

  const endConsultation = async () => {
    if (vapiRef.current) {
      try {
        await vapiRef.current.stop();
      } catch (error) {
        console.error("Error ending call:", error);
      }
    }

    // Clear timer
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }

    setIsCallActive(false);
    setCallTimer(0);
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? "0" : ""}${remainingSeconds}`;
  };

  const goBack = () => {
    // End call if active before navigating
    if (isCallActive) {
      endConsultation();
    }
    navigate(-1);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center mb-8">
        <Button
          variant="ghost"
          size="icon"
          className="mr-2"
          onClick={goBack}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">AI Consultation</h1>

        {isCallActive && (
          <div className="ml-auto flex items-center">
            <div className="flex items-center bg-green-100 text-green-800 px-3 py-1 rounded-full">
              <span className="animate-pulse h-2 w-2 bg-green-500 rounded-full mr-2"></span>
              <span>Call Active: {formatTime(callTimer)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Token Error Message */}
      {tokenError && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4 flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          <div>
            <p className="font-semibold">Session Error</p>
            <p>{tokenError}</p>
          </div>
        </div>
      )}

      {callError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {callError}
        </div>
      )}

      <Card className="p-6">
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">
              {isCallActive
                ? "Speak with our AI Medical Assistant"
                : "Upload a Medical Document"}
            </h2>
            <p className="text-gray-600">
              {isCallActive
                ? "Discuss your uploaded document with our AI assistant"
                : "Upload a medical document to get started with your consultation"}
            </p>
          </div>

          <div
            className={`border-2 border-dashed rounded-lg p-6 ${isCallActive ? "opacity-50" : ""}`}
          >
            <div className="text-center">
              <label
                htmlFor="file-upload"
                className="cursor-pointer"
              >
                <div className="mx-auto h-24 w-24 text-gray-400 mb-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-full w-full"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </div>
                <div className="space-y-1 text-center">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium text-blue-600 hover:underline">
                      Upload a file
                    </span>{" "}
                    or drag and drop
                  </p>
                  <p className="text-xs text-gray-500">
                    Medical image documents only
                  </p>
                </div>
                <input
                  id="file-upload"
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={isProcessing || isCallActive || tokenError}
                />
              </label>
            </div>

            {file && (
              <div className="mt-4">
                {isProcessing ? (
                  <div className="space-y-2">
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                        style={{ width: `${processingProgress}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-gray-600 text-center">
                      {
                        processingMessages[
                          Math.floor(
                            (processingMessages.length * processingProgress) /
                              100
                          )
                        ]
                      }
                    </p>
                  </div>
                ) : (
                  <p
                    className={`text-sm text-center ${
                      uploadStatus.includes("Error")
                        ? "text-red-400"
                        : "text-green-400"
                    }`}
                  >
                    {uploadStatus}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-center">
            <Button
              onClick={isCallActive ? endConsultation : startDiscussion}
              disabled={
                !documentText || isProcessing || isStartingCall || tokenError
              }
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
