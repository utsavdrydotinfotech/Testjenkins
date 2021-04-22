FROM ubuntu

MAINTAINER "utsavd@rydotinfotech.com"

# Update aptitude with new repo
RUN apt-get update

# Install software 
RUN apt-get install -y git
# Make ssh dir
RUN mkdir /root/.ssh/

# Copy over private key, and set permissions
# Warning! Anyone who gets their hands on this image will be able
# to retrieve this private key file from the corresponding image layer
ADD id_rsa /root/.ssh/id_rsa
ADD install.sh /
ADD start.sh /
ADD env.js /
# Create known_hosts
RUN touch /root/.ssh/known_hosts
# Add bitbuckets key
RUN ssh-keyscan bitbucket.org >> /root/.ssh/known_hosts

# Replace shell with bash so we can source files
RUN rm /bin/sh && ln -s /bin/bash /bin/sh

# Set debconf to run non-interactively
RUN echo 'debconf debconf/frontend select Noninteractive' | debconf-set-selections

# Install base dependencies
RUN apt-get update && apt-get install -y -q --no-install-recommends \
        apt-transport-https \
        build-essential \
        ca-certificates \
        curl \
        git \
        vim \
        net-tools \
        libssl-dev \
        wget \
    && rm -rf /var/lib/apt/lists/*


# Clone the conf files into the docker container

RUN /install.sh

#install node and nvm npm manually as below
#curl https://raw.githubusercontent.com/creationix/nvm/master/install.sh | bash
#source ~/.profile
#nvm -v
#nvm install 8.12.0
#nvm install 10.13.0
#nvm use 10.13.0
#nvm alias default 10.13.0
#node -v
#npm install -g @angular/cli
#npm install -g @angular/cli@6
#npm install -g @angular/cli@7 
#npm install -g pm2


