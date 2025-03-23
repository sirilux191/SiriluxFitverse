import FileUpload from "../../Functions/file-upload";

import { motion } from "framer-motion";

export default function UploadContent() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="max-w-6xl mx-auto py-12 px-2 sm:px-4 lg:px-6"
    >
      <div className="flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
        <motion.h1
          initial={{ y: -20 }}
          animate={{ y: 0 }}
          className="mt-4 text-4xl font-bold bg-gradient-to-r from-green-400 to-amber-400 bg-clip-text text-transparent"
        >
          Upload your Health Data
        </motion.h1>
        <p className="mt-2 text-lg text-gray-600">
          Choose a suitable format to upload your data.
        </p>
        <FileUpload />
      </div>
    </motion.div>
  );
}
