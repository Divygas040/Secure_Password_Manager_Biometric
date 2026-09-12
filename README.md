# 🔐 Secure Password Manager with Biometric Authentication

A secure, modern password manager application featuring biometric authentication for enhanced security. This full-stack application provides a user-friendly interface for managing passwords while ensuring your sensitive data is protected with industry-standard encryption and biometric verification.

## ✨ Features

- 🔒 **Secure Password Storage** - Encrypted password storage with industry-standard encryption
- 👆 **Biometric Authentication** - Fingerprint and face recognition support for secure access
- 🎨 **Modern UI** - Clean and intuitive user interface built with React
- 🔑 **Password Generation** - Generate strong, random passwords
- 📱 **Cross-Platform** - Works on multiple platforms and devices
- 🔐 **Master Password Protection** - Additional layer of security with master password
- 📊 **Password Strength Analysis** - Real-time password strength indicators
- 🔍 **Search & Filter** - Easily find and manage your stored passwords

## 🛠️ Tech Stack

### Frontend
- **TypeScript** - Type-safe JavaScript
- **React** - Modern UI framework
- **CSS** - Styling and responsive design

### Backend
- **Python** - Backend API and server logic
- RESTful API architecture

## 📁 Project Structure

```
Secure_Password_Manager_Biometric/
├── password-manager-frontend/    # Frontend React application
│   ├── src/                      # Source files
│   ├── public/                   # Public assets
│   └── package.json              # Frontend dependencies
│
├── password-manager-backend/     # Backend Python API
│   ├── app/                      # Application code
│   ├── requirements.txt          # Python dependencies
│   └── main.py                   # Entry point
│
└── README.md                     # This file
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v14 or higher) and npm
- **Python** (v3.8 or higher)
- **pip** (Python package manager)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Divy-Goswami/Secure_Password_Manager_Biometric.git
   cd Secure_Password_Manager_Biometric
   ```

2. **Set up the Backend**
   ```bash
   cd password-manager-backend
   pip install -r requirements.txt
   ```

3. **Set up the Frontend**
   ```bash
   cd ../password-manager-frontend
   npm install
   ```

### Running the Application

1. **Start the Backend Server**
   ```bash
   cd password-manager-backend
   python main.py
   # or
   python -m uvicorn main:app --reload
   ```
   The backend API will be available at `http://localhost:8000` (or the configured port).

2. **Start the Frontend Development Server**
   ```bash
   cd password-manager-frontend
   npm start
   ```
   The frontend will be available at `http://localhost:3000` (or the configured port).

## 🔐 Security Features

- **End-to-End Encryption** - All passwords are encrypted before storage
- **Biometric Authentication** - Secure access using fingerprint or face recognition
- **Master Password** - Additional security layer
- **Secure Key Management** - Proper handling of encryption keys
- **No Plain Text Storage** - Passwords are never stored in plain text

## 📝 Usage

1. **First Time Setup**
   - Register a new account
   - Set up your master password
   - Enable biometric authentication (if supported on your device)

2. **Adding Passwords**
   - Click "Add New Password"
   - Enter the website/service name
   - Enter your username/email
   - Enter or generate a password
   - Save securely

3. **Accessing Passwords**
   - Authenticate using biometrics or master password
   - Search for the desired password
   - Copy to clipboard with one click

4. **Generating Strong Passwords**
   - Use the built-in password generator
   - Customize length and character types
   - Copy generated password directly

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 👤 Author

**Divy Goswami**
- GitHub: [@Divy-Goswami](https://github.com/Divy-Goswami)

## 🙏 Acknowledgments

- Thanks to all contributors who have helped improve this project
- Built with security and user privacy as top priorities

## ⚠️ Disclaimer

This password manager is provided as-is for educational and personal use. Always ensure you follow best security practices and keep your master password secure. The developers are not responsible for any data loss or security breaches.

---

⭐ If you find this project helpful, please consider giving it a star!

