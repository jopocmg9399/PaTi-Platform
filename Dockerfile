# Use an official Node runtime as a parent image
FROM node:14

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock (if you have one) into the container
COPY package*.json ./
RUN npm install

# Bundle app's source code into the container
COPY . .

# Expose the container to port 8080
EXPOSE 8080

# Run the app using node command
CMD ["node", "app.js"]