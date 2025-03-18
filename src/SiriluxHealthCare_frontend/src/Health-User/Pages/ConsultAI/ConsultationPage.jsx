import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertCircle, Download, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import Vapi from "@vapi-ai/web";
import useActorStore from "@/State/Actors/ActorStore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const [documents, setDocuments] = useState([]); // Array of processed documents
  const [files, setFiles] = useState([]); // Array of files
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [isStartingCall, setIsStartingCall] = useState(false);
  const [callError, setCallError] = useState("");
  const [tokenError, setTokenError] = useState("");
  const [callTimer, setCallTimer] = useState(0);
  const [timerInterval, setTimerInterval] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [downloadedFiles, setDownloadedFiles] = useState([]);
  const [selectedDownloadedFiles, setSelectedDownloadedFiles] = useState([]);
  const [isLoadingDownloaded, setIsLoadingDownloaded] = useState(false);

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

    // Load downloaded files from IndexedDB
    fetchDownloadedFiles();

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

  const initDB = () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("downloadedFiles", 1);

      request.onerror = () => reject(request.error);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains("files")) {
          db.createObjectStore("files", { keyPath: "id" });
        }
      };

      request.onsuccess = () => resolve(request.result);
    });
  };

  const fetchDownloadedFiles = async () => {
    setIsLoadingDownloaded(true);
    try {
      const db = await initDB();
      const transaction = db.transaction(["files"], "readonly");
      const store = transaction.objectStore("files");

      const files = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      // Filter for only image and PDF files
      const filteredFiles = files.filter((file) => {
        const dataType = file.data.split(";")[0].split(":")[1];
        return dataType.startsWith("image/") || dataType === "application/pdf";
      });

      setDownloadedFiles(filteredFiles);
      db.close();
    } catch (error) {
      console.error("Error fetching downloaded files:", error);
    } finally {
      setIsLoadingDownloaded(false);
    }
  };

  const toggleFileSelection = async (file) => {
    // Check if file is already selected
    const isSelected = selectedDownloadedFiles.some((f) => f.id === file.id);

    if (isSelected) {
      // Remove from selection
      setSelectedDownloadedFiles((prev) =>
        prev.filter((f) => f.id !== file.id)
      );
      // Also remove from documents if it exists there
      setDocuments((prev) => prev.filter((d) => d.id !== file.id));
    } else {
      // Add to selection
      setSelectedDownloadedFiles((prev) => [...prev, file]);

      try {
        // Set processing status to show progress indicators
        setIsProcessing(true);
        setUploadStatus(`Processing ${file.name}...`);
        setProcessingProgress(0);

        // Start progress simulation
        const progressInterval = setInterval(() => {
          setProcessingProgress((prev) => {
            const newProgress = prev + Math.random() * 5;
            return newProgress >= 100 ? 99 : newProgress;
          });
        }, 150);

        // Convert file data to appropriate format for document processing
        const response = await fetch(file.data);
        const blob = await response.blob();

        // For images, process them directly
        if (file.data.startsWith("data:image/")) {
          await processDocument(file.data, file.name, file.id);
        }
        // For PDFs, need to extract text differently - here we'd use a PDF parser
        else if (file.data.startsWith("data:application/pdf")) {
          // This is a placeholder - you would need to implement PDF text extraction
          // For now, we'll just add it with empty text
          setDocuments((prev) => [
            ...prev,
            {
              id: file.id,
              name: file.name,
              text: "PDF content (text extraction pending)",
              image:
                "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAAK/INwWK6QAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAHhSURBVDjLjZPLSxtRFIfVZRdWi0oFBf+BrhRx5dKVYKG4tLhRqlgXPmIVJQvfqNRX0jw0j8bYPGpirGYSX0lUdECbJibP0bwmOBPt8R4YMhDahTnwcTjA+X7n3AOIAGD0E1vLfZKsHW9E7fhSQNZOBWSt9yuiqMflsk5F4QjOL9KIb65BfFuH8CSAy1QaF9IZiCcziBPSWuQK7v5+Q2WxgvtthRC3C3hbXAJIFvH3JNwFK41Ti6IaJIvX0jpaRKSKqPgOqpsVTIgCJtYXMV7M4yEm4W5zBZXYIq5XpNvQowho/wDa5W10ikU8E/iI4R+xPCeNQiSMeLgMSQwgHPWJQcuCwJyBCcGZCjycn8KowGA5bRJ8QWAOGnMMoUAXyYjBjYfkQNxX5yQwJaCxgMnxAYyYQfxrwL3CymcMnlIBgyw7ll+Y44aRyfEyfBfchnUmxXdNGjeo1uxTkfFltjzrOVOaOXBHuO9esYNdrMvVvqMdW/x8XNWNHtY1VzrluiipN157K6pa8AKdnJQfqkdT+heK9t7MiqiV6AAAAABJRU5ErkJggg==",
            },
          ]);

          setProcessingProgress(100);
          setUploadStatus("PDF document added successfully!");
        }

        // Clear the progress simulation interval
        clearInterval(progressInterval);
      } catch (error) {
        console.error("Error processing downloaded file:", error);
        setUploadStatus("Error processing document: " + error.message);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleFileChange = (event) => {
    const selectedFiles = Array.from(event.target.files);
    if (selectedFiles.length > 0) {
      setFiles((prevFiles) => [...prevFiles, ...selectedFiles]);
      setUploadStatus(`${selectedFiles.length} document(s) selected`);

      // Process each selected file
      selectedFiles.forEach((file) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          processDocument(reader.result, file.name);
        };
        reader.onerror = (error) => {
          setUploadStatus("Error reading file: " + error);
        };
      });
    }
  };

  const processDocument = async (imageData, fileName, fileId = null) => {
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

      // Add processed document to documents array
      setDocuments((prevDocs) => [
        ...prevDocs,
        {
          id: fileId || Date.now().toString(), // Use provided ID or generate one
          name: fileName,
          text: data.text,
          image: imageData,
        },
      ]);

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

  const removeDocument = (index) => {
    const docToRemove = documents[index];
    setDocuments((prevDocs) => prevDocs.filter((_, i) => i !== index));
    setFiles((prevFiles) => prevFiles.filter((_, i) => i !== index));

    // Also remove from selectedDownloadedFiles if it's a downloaded file
    if (docToRemove.id) {
      setSelectedDownloadedFiles((prev) =>
        prev.filter((file) => file.id !== docToRemove.id)
      );
    }
  };

  const startDiscussion = async () => {
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
        // Send documents to the assistant if any
        if (documents.length > 0) {
          const docsText = documents
            .map((doc) => `Document: ${doc.name}\nContent: ${doc.text}`)
            .join("\n\n");

          vapiRef.current.send({
            type: "add-message",
            message: {
              role: "system",
              content: `The following medical document(s) have been uploaded by the user. Please analyze them and provide insights: \n\n${docsText}`,
            },
          });
        }
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
                : "Upload Medical Documents (Optional)"}
            </h2>
            <p className="text-gray-600">
              {isCallActive
                ? "Discuss your uploaded documents with our AI assistant"
                : "Upload medical documents to enhance your consultation or start without documents"}
            </p>
          </div>

          {/* Document Preview Section */}
          {documents.length > 0 && (
            <div className="mt-4">
              <h3 className="text-md font-semibold mb-2">
                Selected Documents:
              </h3>

              {/* Processing indicator for both tabs */}
              {isProcessing && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
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
                    {uploadStatus && (
                      <p
                        className={`text-sm text-center ${
                          uploadStatus.includes("Error")
                            ? "text-red-500"
                            : "text-green-500"
                        }`}
                      >
                        {uploadStatus}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {documents.map((doc, index) => (
                  <div
                    key={index}
                    className="relative border rounded-lg p-2"
                  >
                    <div className="absolute top-2 right-2 z-10">
                      <button
                        onClick={() => removeDocument(index)}
                        className="bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        disabled={isCallActive && !doc.addedDuringCall}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                    <div className="h-24 overflow-hidden mb-2">
                      <img
                        src={doc.image}
                        alt={doc.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <p className="text-xs truncate">{doc.name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isCallActive && (
            <Tabs
              defaultValue="upload"
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload">Upload New Documents</TabsTrigger>
                <TabsTrigger value="downloaded">
                  My Downloaded Files
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upload">
                <div className="border-2 border-dashed rounded-lg p-6">
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
                            Upload files
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
                        multiple
                      />
                    </label>
                  </div>

                  {/* Remove the processing indicators from here */}
                  {uploadStatus && !isProcessing && (
                    <p
                      className={`text-sm text-center mt-2 ${
                        uploadStatus.includes("Error")
                          ? "text-red-400"
                          : "text-green-400"
                      }`}
                    >
                      {uploadStatus}
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="downloaded">
                <div className="border rounded-lg p-4">
                  <h3 className="text-lg font-medium mb-3">
                    Previously Downloaded Medical Files
                  </h3>

                  {isLoadingDownloaded ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="mt-2 text-gray-600">
                        Loading your files...
                      </p>
                    </div>
                  ) : downloadedFiles.length === 0 ? (
                    <div className="text-center py-8">
                      <Download className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-600">No downloaded files found</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Files you download will appear here
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {downloadedFiles.map((file) => {
                        const isSelected = selectedDownloadedFiles.some(
                          (f) => f.id === file.id
                        );
                        return (
                          <div
                            key={file.id}
                            className={`relative border rounded-lg p-3 cursor-pointer transition-all duration-200 ${
                              isSelected
                                ? "border-blue-500 bg-blue-50"
                                : "hover:border-gray-400"
                            }`}
                            onClick={() => toggleFileSelection(file)}
                          >
                            {isSelected && (
                              <div className="absolute top-2 right-2 z-10 bg-blue-500 rounded-full p-1 text-white">
                                <Check className="h-3 w-3" />
                              </div>
                            )}
                            <div className="h-24 overflow-hidden mb-2">
                              {file.data.startsWith("data:image/") ? (
                                <img
                                  src={file.data}
                                  alt={file.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex items-center justify-center h-full bg-gray-100">
                                  <svg
                                    className="h-12 w-12 text-gray-400"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                </div>
                              )}
                            </div>
                            <p className="text-xs truncate">{file.name}</p>
                            <p className="text-xs text-gray-500 truncate">
                              {new Date(file.timestamp).toLocaleDateString()}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}

          <div className="flex justify-center">
            <Button
              onClick={isCallActive ? endConsultation : startDiscussion}
              disabled={isProcessing || isStartingCall || tokenError}
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
