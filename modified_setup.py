#!/usr/bin/env python3
"""
SupplierFinder Setup Script
This script automates the setup process for the SupplierFinder application.
"""

import os
import sys
import subprocess
import json
import re
import configparser
from pathlib import Path

# Define colors for terminal output
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_step(message):
    """Print a step message with formatting"""
    print(f"\n{Colors.HEADER}==>{Colors.ENDC} {Colors.BOLD}{message}{Colors.ENDC}")

def print_success(message):
    """Print a success message with formatting"""
    print(f"{Colors.GREEN}✓ {message}{Colors.ENDC}")

def print_error(message):
    """Print an error message with formatting"""
    print(f"{Colors.FAIL}✗ ERROR: {message}{Colors.ENDC}")

def run_command(command, error_message="Command failed", capture_output=False):
    """Run a shell command and handle errors"""
    try:
        if capture_output:
            result = subprocess.run(command, shell=True, check=True, 
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE, 
                                   universal_newlines=True)
            return result.stdout.strip()
        else:
            subprocess.run(command, shell=True, check=True)
        return True
    except subprocess.CalledProcessError as e:
        print_error(f"{error_message}: {e}")
        if capture_output:
            print(f"Output: {e.stdout}")
            print(f"Error: {e.stderr}")
        return False

def clone_repository():
    """Clone the SupplierFinder repository"""
    print_step("Cloning SupplierFinder repository")
    
    # For Replit, we'll use the provided repository URL directly
    repo_url = "https://github.com/Andmodule/SupplierFinder"
    print(f"{Colors.BLUE}Using repository URL: {repo_url}{Colors.ENDC}")
    
    # Extract repo name for the target directory
    repo_name = repo_url.split('/')[-1].replace('.git', '')
    
    # Check if directory already exists
    if os.path.exists(repo_name):
        print(f"{Colors.WARNING}Directory {repo_name} already exists. Using existing repository.{Colors.ENDC}")
        return repo_name
    
    if run_command(f"git clone {repo_url}", "Failed to clone repository"):
        print_success(f"Repository cloned successfully to {repo_name}")
        return repo_name
    else:
        sys.exit(1)

def detect_project_type(repo_dir):
    """Detect the type of project based on files present"""
    print_step("Analyzing project structure")
    
    project_info = {
        "language": None,
        "framework": None,
        "database_type": None,
        "package_file": None,
        "has_dockerfile": False,
        "has_docker_compose": False,
        "env_file": None
    }
    
    # Check for various project indicators
    if os.path.exists(f"{repo_dir}/requirements.txt"):
        project_info["language"] = "python"
        project_info["package_file"] = "requirements.txt"
        
        # Check for Python frameworks
        with open(f"{repo_dir}/requirements.txt", 'r') as f:
            requirements = f.read().lower()
            if "django" in requirements:
                project_info["framework"] = "django"
            elif "flask" in requirements:
                project_info["framework"] = "flask"
            elif "fastapi" in requirements:
                project_info["framework"] = "fastapi"
                
    elif os.path.exists(f"{repo_dir}/package.json"):
        project_info["language"] = "javascript"
        project_info["package_file"] = "package.json"
        
        # Parse package.json for details
        with open(f"{repo_dir}/package.json", 'r') as f:
            try:
                package_data = json.load(f)
                dependencies = {**package_data.get("dependencies", {}), **package_data.get("devDependencies", {})}
                
                if "react" in dependencies:
                    project_info["framework"] = "react"
                elif "vue" in dependencies:
                    project_info["framework"] = "vue"
                elif "express" in dependencies:
                    project_info["framework"] = "express"
                elif "next" in dependencies:
                    project_info["framework"] = "nextjs"
            except json.JSONDecodeError:
                print_error("Failed to parse package.json")
    
    # Check for Java/Maven projects
    elif os.path.exists(f"{repo_dir}/pom.xml"):
        project_info["language"] = "java"
        project_info["package_file"] = "pom.xml"
        project_info["framework"] = "spring" if "spring" in open(f"{repo_dir}/pom.xml").read().lower() else "java"
    
    # Check for Ruby projects
    elif os.path.exists(f"{repo_dir}/Gemfile"):
        project_info["language"] = "ruby"
        project_info["package_file"] = "Gemfile"
        project_info["framework"] = "rails" if "rails" in open(f"{repo_dir}/Gemfile").read().lower() else "ruby"
    
    # Check for PHP projects
    elif os.path.exists(f"{repo_dir}/composer.json"):
        project_info["language"] = "php"
        project_info["package_file"] = "composer.json"
        with open(f"{repo_dir}/composer.json", 'r') as f:
            try:
                composer_data = json.load(f)
                if "laravel/framework" in composer_data.get("require", {}):
                    project_info["framework"] = "laravel"
            except json.JSONDecodeError:
                print_error("Failed to parse composer.json")
    
    # Check for Docker
    project_info["has_dockerfile"] = os.path.exists(f"{repo_dir}/Dockerfile")
    project_info["has_docker_compose"] = os.path.exists(f"{repo_dir}/docker-compose.yml")
    
    # Check for environment files
    for env_file in [".env", ".env.example", ".env.sample", "env.sample"]:
        if os.path.exists(f"{repo_dir}/{env_file}"):
            project_info["env_file"] = env_file
            break
    
    # Use existing PostgreSQL database for Replit
    project_info["database_type"] = "postgresql"
    
    # Print detected project info
    print_success("Project analysis complete")
    print(f"{Colors.BLUE}Detected project type:{Colors.ENDC}")
    print(f"  Language: {project_info['language'] or 'Unknown'}")
    print(f"  Framework: {project_info['framework'] or 'Not detected'}")
    print(f"  Database: {project_info['database_type'] or 'Not detected'}")
    print(f"  Package file: {project_info['package_file'] or 'Not detected'}")
    print(f"  Docker: {'Yes' if project_info['has_dockerfile'] else 'No'}")
    print(f"  Docker Compose: {'Yes' if project_info['has_docker_compose'] else 'No'}")
    print(f"  Environment file: {project_info['env_file'] or 'Not detected'}")
    
    return project_info

def setup_environment_variables(repo_dir, project_info):
    """Set up environment variables based on project needs"""
    print_step("Setting up environment variables")
    
    env_file = f"{repo_dir}/.env"
    root_env_file = "./.env"
    
    # Check for the root .env file
    if os.path.exists(root_env_file):
        print_success(f"Found existing .env file in the root directory at {root_env_file}")
        print("Using the environment file from the root directory. No copy needed.")
        # Since we're not copying, we still need to return the path that would be used by the app
        return env_file
    else:
        # Look for example env files to use as template
        env_example = None
        for example_file in [".env.example", ".env.sample", "env.sample", ".env.template"]:
            if os.path.exists(f"{repo_dir}/{example_file}"):
                env_example = f"{repo_dir}/{example_file}"
                break
        
        if env_example:
            print(f"Found environment template file: {env_example}")
            # Copy example to .env if it doesn't exist
            if not os.path.exists(env_file):
                run_command(f"cp {env_example} {env_file}", "Failed to create .env file")
                print_success("Created .env file from template")
                return env_file
        else:
            # Create a basic .env file if no template exists
            if not os.path.exists(env_file):
                with open(env_file, 'w') as f:
                    f.write("# SupplierFinder Environment Variables\n\n")
                    
                    # Add database connection string based on detected database
                    if project_info["database_type"] == "postgresql":
                        f.write(f"DB_HOST={os.environ.get('PGHOST', 'localhost')}\n")
                        f.write(f"DB_PORT={os.environ.get('PGPORT', '5432')}\n")
                        f.write(f"DB_NAME={os.environ.get('PGDATABASE', 'supplierfinder')}\n")
                        f.write(f"DB_USER={os.environ.get('PGUSER', 'postgres')}\n")
                        f.write(f"DB_PASSWORD={os.environ.get('PGPASSWORD', 'password')}\n")
                        f.write(f"DATABASE_URL={os.environ.get('DATABASE_URL', 'postgresql://postgres:password@localhost:5432/supplierfinder')}\n")
                    
                    # Add some common environment variables
                    f.write("\n# Application settings\n")
                    f.write("DEBUG=True\n")
                    f.write("SECRET_KEY=dev_secret_key_replace_in_production\n")
                    f.write("PORT=5000\n")
                
                print_success("Created basic .env file")
                
            return env_file
    
    return env_file

def install_dependencies(repo_dir, project_info):
    """Install dependencies based on the project type"""
    print_step("Installing project dependencies")
    
    os.chdir(repo_dir)
    
    if project_info["language"] == "python":
        run_command("pip install -r requirements.txt", "Failed to install Python dependencies")
        print_success("Python dependencies installed")
        
        # Install database-specific packages if needed
        if project_info["database_type"] == "postgresql":
            try:
                with open("requirements.txt", "r") as f:
                    requirements = f.read()
                if "psycopg2" not in requirements and "psycopg2-binary" not in requirements:
                    run_command("pip install psycopg2-binary", "Failed to install PostgreSQL driver")
                    print_success("PostgreSQL driver installed")
            except Exception as e:
                print_error(f"Error checking requirements file: {e}")
                run_command("pip install psycopg2-binary", "Failed to install PostgreSQL driver")
                
    elif project_info["language"] == "javascript":
        # Check if yarn.lock exists
        if os.path.exists("yarn.lock"):
            run_command("yarn install", "Failed to install JavaScript dependencies with yarn")
            print_success("JavaScript dependencies installed with yarn")
        else:
            run_command("npm install", "Failed to install JavaScript dependencies with npm")
            print_success("JavaScript dependencies installed with npm")
            
    elif project_info["language"] == "ruby":
        run_command("bundle install", "Failed to install Ruby dependencies")
        print_success("Ruby dependencies installed")
        
    elif project_info["language"] == "php":
        run_command("composer install", "Failed to install PHP dependencies")
        print_success("PHP dependencies installed")
        
    elif project_info["language"] == "java":
        run_command("mvn install -DskipTests", "Failed to install Java dependencies")
        print_success("Java dependencies installed")
        
    # Return to original directory
    os.chdir("..")

def detect_startup_command(repo_dir, project_info):
    """Detect how to start the application"""
    print_step("Determining how to start the application")
    
    startup_command = None
    
    if project_info["language"] == "python":
        # Look for common Python app entry points
        common_files = ["app.py", "main.py", "run.py", "server.py", "application.py", "wsgi.py", "manage.py"]
        
        for file in common_files:
            if os.path.exists(f"{repo_dir}/{file}"):
                if file == "manage.py" and project_info["framework"] == "django":
                    startup_command = f"cd {repo_dir} && python manage.py runserver 0.0.0.0:5000"
                else:
                    startup_command = f"cd {repo_dir} && python {file}"
                break
                
        # Check for Procfile (Heroku style)
        if not startup_command and os.path.exists(f"{repo_dir}/Procfile"):
            with open(f"{repo_dir}/Procfile", 'r') as f:
                procfile_content = f.read()
                web_match = re.search(r'web:\s*(.*)', procfile_content)
                if web_match:
                    startup_command = f"cd {repo_dir} && {web_match.group(1)}"
        
    elif project_info["language"] == "javascript":
        # Check package.json for start script
        if os.path.exists(f"{repo_dir}/package.json"):
            with open(f"{repo_dir}/package.json", 'r') as f:
                try:
                    package_data = json.load(f)
                    if "scripts" in package_data and "start" in package_data["scripts"]:
                        # Use yarn if yarn.lock exists, otherwise npm
                        if os.path.exists(f"{repo_dir}/yarn.lock"):
                            startup_command = f"cd {repo_dir} && yarn start"
                        else:
                            startup_command = f"cd {repo_dir} && npm start"
                    elif "scripts" in package_data and "dev" in package_data["scripts"]:
                        # Use development script if available
                        if os.path.exists(f"{repo_dir}/yarn.lock"):
                            startup_command = f"cd {repo_dir} && yarn dev"
                        else:
                            startup_command = f"cd {repo_dir} && npm run dev"
                except json.JSONDecodeError:
                    print_error("Failed to parse package.json")
        
        # Check for index.js or server.js
        if not startup_command:
            for file in ["index.js", "server.js", "app.js"]:
                if os.path.exists(f"{repo_dir}/{file}"):
                    startup_command = f"cd {repo_dir} && node {file}"
                    break
    
    elif project_info["language"] == "ruby" and project_info["framework"] == "rails":
        startup_command = f"cd {repo_dir} && bundle exec rails server -p 5000 -b 0.0.0.0"
    
    if startup_command:
        print_success(f"Startup command detected: {startup_command}")
    else:
        print_error("Could not determine startup command")
        startup_command = "echo 'Please modify the run.sh script to specify how to start the application'"
    
    # Create a run script
    with open("run.sh", "w") as f:
        f.write("#!/bin/bash\n\n")
        f.write("echo \"Starting SupplierFinder application...\"\n\n")
        f.write(f"# Startup command\n{startup_command}\n")
    
    # Make the script executable
    run_command("chmod +x run.sh", "Failed to make run.sh executable")
    
    return startup_command

def main():
    print(f"{Colors.HEADER}{Colors.BOLD}SupplierFinder Application Setup{Colors.ENDC}")
    print("This script will set up the SupplierFinder application from GitHub.")
    
    # Clone repository
    repo_dir = clone_repository()
    
    # Detect project type
    project_info = detect_project_type(repo_dir)
    
    # Setup environment variables
    env_file = setup_environment_variables(repo_dir, project_info)
    
    # Install dependencies
    install_dependencies(repo_dir, project_info)
    
    # Detect startup command
    startup_command = detect_startup_command(repo_dir, project_info)
    
    print_success(f"\nSetup complete! The SupplierFinder application is now installed.")
    print(f"\nTo start the application, run: {Colors.BOLD}./run.sh{Colors.ENDC}")

if __name__ == "__main__":
    main()