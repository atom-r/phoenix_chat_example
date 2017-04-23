import ApolloClient from 'apollo-client'
import {createNetworkInterface} from 'apollo-phoenix-websocket'
import gql from 'graphql-tag'
import {Socket, LongPoller} from 'phoenix'

class App {
  static init() {
    var $status    = $("#status")
    var $messages  = $("#messages")
    var $input     = $("#message-input")
    var $username  = $("#username")

    const networkInterface = createNetworkInterface({
      uri: 'ws://localhost:4000/socket',
      logger: ((kind, msg, data) => { console.log(`${kind}: ${msg}`, data) }),
      channel: {
        topic: '__absinthe__:control',
        in_msg: 'doc',
        subscriptionEvent: ({ref}) => ref,
      },
    })

    const apolloClient = new ApolloClient({ networkInterface })
    const observable = apolloClient.subscribe({
      query: gql`
      subscription Messages {
        message(room: "lobby") {
          body
          author { name }
        }
      }
      `,
      variables: {}
    })

    const observer = observable.subscribe({
      next: (response) => {
        $messages.append(this.messageTemplate(response.data))
        scrollTo(0, document.body.scrollHeight)
      },
      error: (error) => {
        console.log("got lobby error", error)
      }
    })

    $input.off("keypress").on("keypress", e => {
      if (e.keyCode == 13) {

        apolloClient.mutate({
          mutation:
          gql`
          mutation SendMessage($body: String!, $user: String!) {
            sendMessage(room: "lobby", body: $body, user: $user) {
              __typename
            }
          }
          `,
          variables: {
            body: $input.val(),
            user: $username.val()
          }
        })

      }
    })

  }

  static sanitize(html){ return $("<div/>").text(html).html() }

  static messageTemplate(data){
    let message = data.message
    let username = this.sanitize(message.author.name || "anonymous")
    let body     = this.sanitize(message.body)

    return(`<p><a href='#'>[${username}]</a>&nbsp; ${body}</p>`)
  }
}

class App0 {

  static init(){
    let socket = new Socket("/socket", {
      logger: ((kind, msg, data) => { console.log(`${kind}: ${msg}`, data) })
    })

    socket.connect({user_id: "123"})
    var $status    = $("#status")
    var $messages  = $("#messages")
    var $input     = $("#message-input")
    var $username  = $("#username")

    socket.onOpen( ev => console.log("OPEN", ev) )
    socket.onError( ev => console.log("ERROR", ev) )
    socket.onClose( e => console.log("CLOSE", e))

    var chan = socket.channel("__absinthe__:control", {})

    let subscription = {
      query: `
      subscription Messages {
        message(room: "lobby") {
          body
          author { name }
        }
      }
      `,
      variables: {}
    }

    chan.join().receive("ignore", () => console.log("auth error"))
      .receive("ok", () => {
        console.log("join ok")

        chan.push("doc", subscription)
          .receive("ok", (msg) => {
            console.log("subscription created", msg)

            const {ref} = msg
            chan.on(ref, msg => {
              $messages.append(this.messageTemplate(msg.data))
              scrollTo(0, document.body.scrollHeight)
            })

          })
          .receive("error", (reasons) => console.log("subscription failed", reasons) )
          .receive("timeout", () => console.log("Networking issue...") )
      })
      //.after(10000, () => console.log("Connection interruption"))


    $input.off("keypress").on("keypress", e => {
      if (e.keyCode == 13) {
        chan.push("doc", {
          query:
          `
          mutation SendMessage($body: String!, $user: String!) {
            sendMessage(room: "lobby", body: $body, user: $user) {
              __typename
            }
          }
          `,
          variables: {
            body: $input.val(),
            user: $username.val()
          }
        })
        .receive("ok", (msg) => console.log("mutation succeeded", msg) )
        .receive("error", (reasons) => console.log("mutation failed", reasons) )
        .receive("timeout", () => console.log("Networking issue...") )
        $input.val("")
      }
    })

    chan.on("user:entered", msg => {
      var username = this.sanitize(msg.user || "anonymous")
      $messages.append(`<br/><i>[${username} entered]</i>`)
    })
  }

  static sanitize(html){ return $("<div/>").text(html).html() }

  static messageTemplate(data){
    let message = data.message
    let username = this.sanitize(message.author.name || "anonymous")
    let body     = this.sanitize(message.body)

    return(`<p><a href='#'>[${username}]</a>&nbsp; ${body}</p>`)
  }

}

$( () => App.init() )

export default App
