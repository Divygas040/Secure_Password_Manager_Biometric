
---

# Password Manager with Biometric Authentication

A password manager application that ensures secure login through **biometric authentication** (Face ID) and **OTP verification** (Google Authenticator). This application allows users to manage and securely store passwords for various services.

## Features

- **Biometric Authentication**: Supports Face ID or fingerprint authentication.
- **OTP Verification**: Uses One-Time Password (OTP) for secure authentication.
- **Login & Signup**: Users can log in or sign up with email and password.
- **Password Management**: Users can securely store and view their passwords in an encrypted format.

---

## Getting Started

Follow these steps to get the project up and running on your local machine.

### Prerequisites

Make sure you have the following installed:

- [Node.js](https://nodejs.org/) (v16 or higher)
- [Yarn](https://classic.yarnpkg.com/en/docs/install/) or [npm](https://www.npmjs.com/)
- [Next.js](https://nextjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)

### Installation

1. **Clone the repository**:

   ```bash
   git clone <repository_url>
   cd password-manager-biometric-auth
   ```

2. **Install dependencies**:

   Using Yarn:

   ```bash
   yarn install
   ```

   Using npm:

   ```bash
   npm install
   ```

3. **Run the project**:

   Using Yarn:

   ```bash
   yarn dev
   ```

   Using npm:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

---

## File Structure

Here’s an overview of the main project files:

- **`/app`**: Contains the main application pages (auth, dashboard, etc.)
- **`/context`**: Includes the `AuthContext` to manage authentication state.
- **`/styles`**: Contains the global CSS and Tailwind styling.
- **`/components`**: Reusable components for input fields, buttons, etc.

---

## Pages

### Home Page

- **Route**: `/`
- **Description**: The landing page that greets the user with the application title and a button to navigate to the login/signup page.

### Login & Sign Up

- **Route**: `/auth`
- **Description**: A page where users can log in with their email and password, or sign up for a new account. 

  - **Login Page**: Validates the user credentials (`test@example.com`, `password123`).
  - **Sign Up Page**: Prompts the user to enter their details (name, email, password).

### Dashboard

- **Route**: `/dashboard`
- **Description**: The user dashboard that allows them to view saved passwords after successful login. Requires Face ID and OTP verification.

---

## Authentication Flow

1. **Login**: 
   - The user enters their email and password to authenticate.
   - On successful login, the user is redirected to the dashboard.

2. **Signup**: 
   - The user provides additional details like name, phone number, email, and password to create an account.
   
3. **Biometric Authentication**: 
   - The user is prompted for Face ID or fingerprint verification to access their dashboard.

4. **OTP Verification**:
   - After biometric verification, the user needs to enter the OTP received on their device.

---

## Additional Notes

- **Toast Notifications**: For feedback on login success/failure and OTP validation, the application uses `react-hot-toast`.
- **State Management**: Authentication state is managed globally using React Context API.

---

## Technologies Used

- **React**: JavaScript library for building the user interface.
- **Next.js**: React framework for server-side rendering.
- **Tailwind CSS**: Utility-first CSS framework for styling.
- **React Hot Toast**: For displaying toast notifications.
- **React Context API**: For managing authentication state globally.

---

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Create a new Pull Request

---

## License

This project is open-source and available under the MIT License.

---
