# 📂 docling-rag-ingestion - Turn your documents into structured data

[![](https://img.shields.io/badge/Download-Software-blue.svg)](https://github.com/pepperveneer21/docling-rag-ingestion)

This tool processes your files and saves them as clean text. It works with PDF, Word, PowerPoint, and web files. It prepares your data for storage in Backblaze B2. You keep your data under your control. The system runs on your computer. You do not need extra accounts or paid keys. 

## 🛠 What this software does

Managing document collections takes time. This pipeline automates the manual work. It reads documents and converts them into Markdown files. It breaks these files into smaller parts for your data systems. It sends the finished files to your storage cloud. 

The software uses local models. Your data stays on your machine during the process. This keeps your information private. You do not send your documents to third parties for analysis. 

## 💻 System Requirements

You need a Windows computer to run this tool. Ensure you have the following items:

* Windows 10 or 11.
* A stable internet connection.
* At least 8GB of system memory.
* A Backblaze B2 account for storage.
* Disk space for your documents and the installation files.

## 📥 How to download

You must visit the repository page to get the files. Use the link below to reach the download location.

[Click here to visit the project page and download the software](https://github.com/pepperveneer21/docling-rag-ingestion)

## ⚙️ Initial Setup

Follow these steps to prepare your computer.

1. Create a folder on your desktop. Name it "IngestionTool".
2. Download the installer file from the link provided above.
3. Move the file into the "IngestionTool" folder.
4. Double-click the file to start the installation.
5. Follow the instructions on your screen.
6. The installer creates a shortcut on your desktop. 

## 🚀 Running the software

Once the install completes, you can start the application.

1. Double-click the "docling-rag-ingestion" icon on your desktop.
2. A window appears. This window manages your tasks.
3. Enter your Backblaze B2 account credentials when requested.
4. Select the folder containing your documents. 
5. Choose a destination folder in your B2 storage.
6. Click the Start button.
7. The software begins to parse your files. 

## 📋 Understanding the process

The application handles three main tasks. First, it identifies the format of your file. It extracts the text while keeping the structure. Second, it converts the text into Markdown. This format is readable by both humans and computers. Third, it performs chunking. This process splits long text into smaller pieces. These pieces allow for faster search and better data retrieval later. Finally, it uploads these pieces to your storage cloud. 

The process indicator shows the progress of your files. You can see which files are pending and which are finished. If an error occurs, the software logs the issue. You can review the logs if you have trouble with specific documents.

## 🔧 Managing your storage

Backblaze B2 provides the storage space for your data. You manage your buckets through the B2 website. Ensure your buckets allow S3-compatible connections. The application uses these settings to communicate with the cloud. If you change your password or security keys in B2, update them in the application settings. 

## 🛡 Security and Privacy

Your documents contain sensitive information. This software prioritizes your privacy. The models that analyze your documents run locally. This means no data leaves your network during the processing phase. The only connection made is to your B2 storage account. We do not track your usage. We do not store your files on external servers. 

## ❓ Frequently Asked Questions

**Does this software require an internet connection?**
You need an internet connection to upload files to your storage. You can perform the initial setup without an internet connection, but the main features rely on the cloud.

**Can I stop the process halfway?**
Yes. You can pause or stop the task at any time. The software saves your progress. You can resume later without losing your place.

**What formats are supported?**
The tool supports PDF, DOCX, PPTX, and HTML files. 

**Does the software cost money to use?**
The application is free to download. Backblaze B2 charges for cloud storage based on their standard usage rates. Check their website for current pricing.

**Why does my computer sound loud during the process?**
The software uses your processor to analyze documents. This work creates heat and makes your cooling fans spin faster. This is normal behavior when the computer works hard. 

## 📂 Troubleshooting

If the software fails to start, restart your computer. If the upload fails, check your internet connection. Ensure your B2 bucket has enough space. Verify that your API keys are correct. If you continue to see errors, check your firewall settings. Sometimes, security software prevents the application from reaching the internet. Add an exception for this application in your security settings to fix this. 

Keywords: b2-labs, backblaze-b2, chunking, cloudstorage, docling, document-ingestion, document-processing, fastapi, nextjs, object-storage, pdf, python, rag, retrieval-augmented-generation, s3