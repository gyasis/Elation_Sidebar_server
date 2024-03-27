                                                                                            # Use an official Node.js runtime as the base image
FROM node:20

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install the application dependencies
RUN npm install

# Copy the rest of the application code to the working directory
COPY . .

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3100
# Add any other environment variables your application needs

# Expose the port the app runs on
EXPOSE 3100

# Define the command to run the application
CMD [ "node", "server.js" ]
