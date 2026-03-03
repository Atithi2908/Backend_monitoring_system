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

        stage('Build Images') {
            steps {
                sh 'docker-compose build'
            }
        }

        stage('Deploy to EC2') {
            steps {
                sshagent(['ec2-ssh']) {
                    sh '''
                    ssh -o StrictHostKeyChecking=no ubuntu@16.170.173.185 << EOF
                        cd app &&
                        git pull origin main &&
                        docker-compose down &&
                        docker-compose up -d --build
                    "
                    '''
                }
            }
        }
    }

    post {
        success {
            echo 'Deployment successful 🚀'
        }
        failure {
            echo 'Deployment failed ❌'
        }
    }
}