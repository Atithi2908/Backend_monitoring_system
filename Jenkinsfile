pipeline {
    agent any

    stages {

        stage('Checkout Code') {
            steps {
                checkout scm
            }
        }

        stage('Verify Docker') {
            steps {
                sh 'docker version'
            }
        }

        stage('Build Docker Images') {
            steps {
                sh 'docker-compose build'
            }
        }

    }

    post {
        success {
            echo 'Build completed successfully 🚀'
        }
        failure {
            echo 'Build failed ❌'
        }
    }
}