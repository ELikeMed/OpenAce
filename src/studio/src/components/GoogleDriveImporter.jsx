import React, { useState, useEffect } from 'react';
import './GoogleDriveImporter.css';
import { getGoogleStatus, getGoogleAuthUrl, listGoogleDriveFiles, importFromGoogleDrive } from '../api';

function GoogleDriveImporter({ show, onClose }) {
    const [isConnected, setIsConnected] = useState(false);
    const [folders, setFolders] = useState([]);
    const [files, setFiles] = useState([]);
    const [selectedFolder, setSelectedFolder] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (show) {
            checkConnectionStatus();
        }
    }, [show]);

    const checkConnectionStatus = async () => {
        setIsLoading(true);
        try {
            const status = await getGoogleStatus();
            if (status.connected) {
                setIsConnected(true);
                fetchFolders();
            } else {
                setIsConnected(false);
            }
        } catch (error) {
            console.error('Error checking Google connection status:', error);
        }
        setIsLoading(false);
    };

    const handleConnect = async () => {
        try {
            const { authUrl } = await getGoogleAuthUrl();
            window.open(authUrl, '_blank');
        } catch (error) {
            console.error('Error getting Google auth URL:', error);
        }
    };

    const fetchFolders = async () => {
        setIsLoading(true);
        try {
            const folderList = await listGoogleDriveFiles({ fileType: 'folder' });
            setFolders(folderList);
        } catch (error) {
            console.error('Error fetching Google Drive folders:', error);
        }
        setIsLoading(false);
    };

    const fetchFiles = async (folderId) => {
        setIsLoading(true);
        setSelectedFolder(folderId);
        try {
            const fileList = await listGoogleDriveFiles({ folderId });
            setFiles(fileList);
        } catch (error) {
            console.error('Error fetching Google Drive files:', error);
        }
        setIsLoading(false);
    };

    const handleImport = async () => {
        const selectedFiles = files.filter(file => file.selected);
        if (selectedFiles.length === 0) {
            alert('Please select files to import.');
            return;
        }

        setIsLoading(true);
        try {
            await importFromGoogleDrive(selectedFolder, selectedFiles.map(file => file.id));
            alert('Import successful!');
            onClose();
        } catch (error) {
            console.error('Error importing from Google Drive:', error);
            alert('Import failed. See console for details.');
        }
        setIsLoading(false);
    };

    const toggleFileSelection = (fileId) => {
        setFiles(files.map(file =>
            file.id === fileId ? { ...file, selected: !file.selected } : file
        ));
    };


    if (!show) {
        return null;
    }

    return (
        <div className="modal-overlay">
            <div className="google-drive-importer">
                <h2>Import from Google Drive</h2>
                {isLoading && <div className="spinner"></div>}
                {!isConnected && !isLoading && (
                    <div className="connect-container">
                        <p>Connect your Google Account to import files from Google Drive.</p>
                        <button onClick={handleConnect}>Connect to Google Drive</button>
                    </div>
                )}
                {isConnected && !isLoading && (
                    <div>
                        <div className="folder-list">
                            <h3>Folders</h3>
                            <ul>
                                {folders.map(folder => (
                                    <li key={folder.id} onClick={() => fetchFiles(folder.id)} className={selectedFolder === folder.id ? 'selected' : ''}>
                                        {folder.name}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        {selectedFolder && (
                            <div className="file-list">
                                <h3>Files in selected folder</h3>
                                <ul>
                                    {files.map(file => (
                                        <li key={file.id}>
                                            <input type="checkbox" checked={!!file.selected} onChange={() => toggleFileSelection(file.id)} />
                                            {file.name}
                                        </li>
                                    ))}
                                </ul>
                                <button onClick={handleImport} disabled={!files.some(f => f.selected)}>Import Selected Files</button>
                            </div>
                        )}
                    </div>
                )}
                <button onClick={onClose} className="close-button">Close</button>
            </div>
        </div>
    );
}

export default GoogleDriveImporter;
