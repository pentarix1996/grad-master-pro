# GradMasterPro

**GradMasterPro** is a modern, intuitive web application designed for educators to efficiently manage courses, students, and grades. Built with React and TypeScript, it offers a dynamic user interface for configuring weighted grading systems, tracking student performance, and analyzing class statistics in real-time.

![Project Status](https://img.shields.io/badge/status-active-success.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## 🚀 Key Features

*   **Course Management**: Create, edit, and delete multiple courses.
*   **Flexible Configuration**: Define custom sections (e.g., Exams, Homework) and subsections with specific weights impacting the final grade.
*   **Interactive Gradebook**:
    *   Add and manage students.
    *   Input grades with real-time calculation of weighted averages.
    *   Visual feedback on grades (color-coded performance).
*   **Real-Time Statistics**: View class averages, highest/lowest grades, and distribution charts.
*   **Data Persistence**: Automatically saves your work to local storage so you never lose data.
*   **Import/Export**: Backup and restore your course data via JSON files.
*   **Dark/Light Mode**: Fully responsive interface with theming support.
*   **Modern UI/UX**: Smooth animations with Framer Motion and clean design using Tailwind CSS.

## 🛠️ Tech Stack

*   **Frontend Framework**: [React](https://react.dev/)
*   **Language**: [TypeScript](https://www.typescriptlang.org/)
*   **Build Tool**: [Vite](https://vitejs.dev/)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
*   **Icons**: [Lucide React](https://lucide.dev/)
*   **Animations**: [Framer Motion](https://www.framer.com/motion/)

## 📦 Installation

To get a local copy up and running, follow these simple steps.

### Prerequisites

*   [Node.js](https://nodejs.org/) (Version 16 or higher recommended)
*   npm or yarn

### Steps

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/GradMasterPro.git
    cd GradMasterPro
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Start the development server**
    ```bash
    npm run dev
    ```

4.  **Open your browser**
    Navigate to `http://localhost:5173` (or the port shown in your terminal).

## 🔧 Scripts

*   `npm run dev`: Starts the development server with HMR.
*   `npm run build`: Type-checks and builds the project for production.
*   `npm run lint`: Runs ESLint to check for code quality issues.
*   `npm run preview`: Locally previews the production build.

## 📖 Usage Guide

1.  **Create a Course**: Click the "+" button to start a new course.
2.  **Configure Sections**:
    *   Add sections (e.g., "Midterm", "Final").
    *   Assign weights (must sum to 100%).
    *   Add subsections (e.g., "Question 1", "Question 2").
3.  **Manage Students**:
    *   Go to the "Gradebook" tab.
    *   Add students by name.
    *   Click on cells to input grades (0-10 or 0-100 depending on your preference, UI supports standard numeric input).
4.  **Export Data**: Use the "Download" icon in the top header to save your data as a JSON file.

## 📂 Project Structure

```
GradMasterPro/
├── src/
│   ├── components/         # Reusable UI components (if separated)
│   ├── App.tsx            # Main application logic and components
│   ├── main.tsx           # Entry point
│   ├── index.css          # Global styles (Tailwind directives)
│   └── App.css            # Component specific styles
├── public/                # Static assets
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── vite.config.ts         # Vite configuration
└── README.md              # Project documentation
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
