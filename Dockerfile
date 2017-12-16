FROM node:8

# add a non-root user and give them ownership
RUN useradd -u 9000 app && \
    # user home directory
    mkdir /home/app && \
    chown -R app:app /home/app && \
    # repo
    mkdir /repo && \
    chown -R app:app /repo && \
    # collector code
    mkdir -p /usr/src/app && \
    chown -R app:app /usr/src/app

WORKDIR /usr/src/app
ADD package.json /usr/src/app
ADD yarn.lock /usr/src/app
# install anything else we need
RUN yarn install --production

ENV PATH="/usr/src/app/node_modules/.bin:${PATH}"

# add the pullrequest utility to easily create pull requests on different git hosts
ENV PULLREQUEST_VERSION=0.6.0
RUN wget https://github.com/dependencies-io/pullrequest/releases/download/${PULLREQUEST_VERSION}/pullrequest_${PULLREQUEST_VERSION}_linux_amd64.tar.gz && \
    mkdir pullrequest && \
    tar -zxvf pullrequest_${PULLREQUEST_VERSION}_linux_amd64.tar.gz -C pullrequest && \
    ln -s /usr/src/app/pullrequest/pullrequest /usr/local/bin/pullrequest

# run everything from here on as non-root
USER app

RUN git config --global user.email "bot@dependencies.io"
RUN git config --global user.name "Dependencies.io Bot"

ADD src /usr/src/app/src
RUN mkdir build && yarn run babel

WORKDIR /repo

ENTRYPOINT ["node", "--optimize_for_size", "--max_old_space_size=460", "/usr/src/app/build/entrypoint.js"]
CMD ["/"]
