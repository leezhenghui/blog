# Boost high scalability network server using event-loop model

Author: Zhenghui Lee

Email: leezhenghui@gmail.com

```
  @Copyright
```

---

Contents Table:

> 0 Preface
> 
> 1 Common I\/O models
> 
> > 1.1 Blocking I\/O
> > 
> > 1.2 Non-blocking I\/O
> > 
> > 1.3 I\/O multiplexing
> > 
> > 1.4 Signal driven I\/O
> > 
> > 1.5 Asynchronous I\/O
> > 
> > 1.6 Blocking vs. Non-blocking
> > 
> > 1.7 Sync vs. Async
> 
> 2 Recap C10K problem
> 
> > 2.1 Issue
> > 
> > > 2.1.1 Thread-Based model
> > 
> > 2.2 Strategies
> > 
> > > 2.2.1 Reactor model
> > > 
> > > > 2.2.1.1 Nonblocking in conjunction with level-triggered readiness notification
> > > > 
> > > > 2.2.1.2 Nonblocking in conjunction with edge-triggered readiness notification
> > > 
> > > 2.2.2 Proactor model
> 
> 3 Linux kernel support
> 
> > > 3.1 Nonblocking I\/O
> > > 
> > > 3.2 Edge-triggered Demultipluxer
> > > 
> > > > 3.2.1 Unix standard signal -- SIGIO
> > > > 
> > > > 3.2.2 POSIX Realtime signal
> > > > 
> > > > 3.2.3 Best practice on Signal based Readiness Notification
> > > > 
> > > > 3.2.3 Epoll
> > > 
> > > 3.3 Level-triggered Demultipluxer
> > > 
> > > > 3.3.1 POXIS select
> > > > 
> > > > 3.3.2 Poll
> > > 
> > > 3.4 Brief summary about demultipluxer techonlogies on each popule OS
> > > 
> > > 3.5 AIO
> > > 
> > > > 3.5.1 Linux Kernal AIO
> > > > 
> > > > 3.5.2 POXIS AIO
> 
> 4 Event-loop programming model
> 
> > 4.1 Tick
> > 
> > 4.2 Known event-loop based framework in different languages
> > 
> > > 4.2.1 C programming
> > > 
> > > > 4.2.1.1 Nginx
> > > > 
> > > > 4.2.1.2 libuv
> > > > 
> > > > 4.2.1.3 libevent
> > > 
> > > 4.2.2 Java programming
> > > 
> > > > 4.2.2.1 Java NIO\(reimplemented based on epoll\)
> > > > 
> > > > 4.2.2.2 Java NIO2 AsyncChannel
> > > > 
> > > > 4.2.2.3 Netty
> > > 
> > > 4.2.3 Node.js
> 
> 5 Weak point in event-loop model
> 
> 6 Alternative approach for C10K
> 
> 7 Wrappup

---

## Preface

```
TODO, Map
```

Today in internet world, a technonical challenge in network server scalability is how to ensure that the server handles a large number of connections simultaneously with a high performance. Explorer the excellent network server designs and implementations, the event-loop programming model seems usually take a key role in this field. Why? What underlying story is? I'd like to jot down this writing which came cross with my earlier investigations and experiences as a future reference for me and any one who come across to this post. Hopefully, this article can walk us throught the milestones\(following the way lighted by [c10k](http://www.kegel.com/c10k.html)\) achieved in the evolution of high scalability network server in Linux.

```
TO-DELETE:

Note: structure reference: https://chamibuddhika.wordpress.com/2012/08/11/io-demystified/
http://www.wangafu.net/~nickm/libevent-book/Ref0_meta.html
(ref: book: unix network programming chapter 6)Before describing select and poll, we need to step back and look at the bigger picture,
examining the basic differences in the five I/O models that are available to us under Unix:
blocking I/O
nonblocking I/O
(busy poll , the bad sample , http://www.wangafu.net/~nickm/libevent-book/01_intro.html)
I/O multiplexing (select and poll)
signal driven
(SIGIO)
Table of I/O
Contents
•
UNIX® Network Programming Volume 1, Third Edition: The Sockets Networking
API
asynchronous I/O (the POSIX aio_functions)
By W. Richard Stevens , Bill Fenner , Andrew M. Rudoff
You may want to skim this section on your first reading and then refer back to it as you
encounter the different I/O models described in more detail in later chapters.
Publisher: Addison Wesley
As we show in all the examples in this section, ....

There is a very good article talking about POXIS AIO API, but If you were reading http://www.ibm.com/developerworks/linux/library/l-async/ , you may feel confusing.. Many years ago, when I first time read that doc, I also feel confusing, but I realized at that time Tim's asyn does not same as the book above.....
```

## Common I\/O models

```
TODO, map
```

Before jumping into the section of "problem" statement, let's step back and take a look at the bigger picture, exploring the basic differences in five common Input\/Output\(short for I\/O\) models under Unix-like operating system as well as the appropriate programming models which well fit in these I\/O models individually.

This is not intented as an exhaustive review to these common I\/O models, but just a quick walk through to illustrate the basic differences in the five common I\/O models. If you want to have a thorough elaboration on these topics, please refer to the bible book - _[UNIX® Network Programming Volume 1](https://en.wikipedia.org/wiki/UNIX_Network_Programming)_.

In Unix-like operating system,  the `file` is actually a principle asbraction of many computer resoruces. Generally, everything with system operations manner of `read` and `write` can be abstracted and represented as a file, including device, disk file, pipe, socket\(both `Internet-Domain sockets` and `Unix-Domain socket`\) and some special purpose files\(e.g: the "virtual" files which are intented for kernel status\/configuration\), they are all files from operating system perspective. What we are calling `regular file` in this article actually stands for `disk file`.

> Note: If you are familiar with these five I\/O models under Unix-like operating system, you can skip the content about these five I\/O types explanations. But I strongly suggest you to read the section 1.6 and section 1.7, as they are aimed to clarify some important terminologies which will be used frequently in this writing. IMO, these terminologies are quite common, but seems people with different background usually explain them from different point of views, such that, in different articles\/books, the meaning of these terminologies are somewhat ambiguous\/confusing. It could be greatly helpful to make us on the same page on these terminologies before we go forward.

### Blocking I\/O

This is a prevalent I\/O model supported by almost all of I\/O devices and popular operating systems. It performs the default I\/O behaviors on the system calls\(i.e: `read` and `write`\) in libc standard library. If we open a file via blocking I\/O\(e.g: either set `O_SYNC` flag explicitly or leave the flag setting empty\), no `read` or `write` will complete until the data is transferred to user-space application buffer from kernel buffer\(in the case of `read`\) or delivered to physical deivce\(in the case of `write`\). The process is blocked until the requested action is completed.

```
TODO, diagram with a socket read/write
```

The diagram above illustrate the execution in the background, when the process issue a `read()` or `write()` system call,  the process will be locked, a context switch from usser space to kernel space occurs under the hood indeed, after either the data copied from device to kernel buffer\(in the case of `read`\) or be delivered to device hardware from kernel buffer\(in the case of `write`\), process context will switch back, the process in user space will be unlocked and start to fetch the result from kernel buffer to user-space application buffer. From user space perspective, we say the process is blocked entire time from when it calls until it turns.

Apparently, as a result of the I\/O handling manner in blocking mode, the system calls to I\/O devices are bound\/blocked to a specifc thread\/process during the I\/O staying in either ready or not ready state. Blocking IO is not necessarily evil. If there’s nothing else you wanted your program to do in the meantime, blocking IO will work fine for you. But if you want to handle multiple connections at once, in order to give a timely handling to each connection, we should limit\/avoid the effect of serialized I\/O handling for multiple concurrent connections in I\/O blocking mode, we probably will fall into `thread-per-connection` strategy. By this way, each connection has its own process, a blocking IO call that waits for one connection won’t make any of the other connections' processes block.`thread-per-connection` can be found in many of early web server implementation, like Apache.

    TODO, move to strategy section

    `thread-per-connection` is fine as long as the I/O connections are short-lived and data link latencies are not bad. But if we want to write a program to handle multiple long-lived and high latency connections simultaneously in blocking I/O mode, we can image a large number of threads/processes are held up and blocked by the long-lived and high latency connections which are in `read`or `write` state, if a fixed size thread/process pool is used here, we will see it become drain, otherwise, we have to spwan new threads/processes to service the new connections. In the worst situation, we might fall into the situation of servicing each connection by a new thread/process, with the concurrency count increasing, the program become more and more resource intensive and CPU context switch are also highly loaded. 

    TODELETE
    For example, the recv() function in TCPEchoClient.c (page 44) does not return until at least one message from the echo server is received. Of course, a process with a blocked function is suspended by the operating system. It is synchronous blocking I/O model, one of the most common models for socket I/O programming. In this model, the user-space application performs a system call that results in the application blocking. This means that the application blocks entirely until the system call is complete (e.g: process calls recvfrom, data is transferred from kernel buffer to user space buffer or error reported)

    We use UDP for example, the process calls recvfrom and the system call does not return until the datagram arrives and is transferred from kernel buffer into our user space buffer, or an error occurs. We say that our process is blocked the entire time from when it calls recvfrom until it returns. When recvfrom returns successfully, our application continue processing the datagram. Imaging that we need to write a program to handle multiple connections at once, we almost no choice but fall into `thread-per-connection` programming model. We will talk about this programming model later with more details.

### Non-blocking I\/O

It is possible that programmers issue a `read()` or `write()` request on a file, rather than putting the process to sleep to wait for data avialable, the call will return immediately with an error code if it is unable to process immediately, catch the error and the request can be reissued later on the same file descriptor for further operations. This is called Non-blocking I\/O. POSIX allows us to turn on the non-blocking mode either using the `O_NONBLOCK` option in the call to open the file or setting non-blocking mode on an already opened file descriptor using the fcntl call. Both of these options are documented in the GNU libc documentation. With this mode, the application can performs I\/O with multiple files, without ever blocking and missing data available in other file.

    TODO move to Linux Kernel Support section

    Generally, non-blocking mode works with file descriptors representing sockets, pipes TTYs and FIFOs. But it does not work for `regular file`(this is true on Linux, even the regular files are opened with `O_DIRECT`. AFAIK, no other popular operating systems support this either). The regular file does NOT like sockets, pipes, TTYs and FIFOs, for example, with sockets on TCP protocol, it could be in `wait` state for the data sent by paired counterpart, readability means there is some unread data arrived and ready in the receive buffer and writeability implies the send buffer is not full from the standpoint of the underlying protocol of the socket (e.g. TCP/IP),  however, regular files are always readable and they are also always writeable. It does not make sense for `regular file` with readability and wrtiability. As POSIX clearly stated in his specifications, putting a regular file in non-blocking has ABSOLUTELY no effects other than changing one bit in the file flags. That is, opening a `regular file` in non-blocking mode has no effect for regular files: a read will always actually read some of the file, even if the program blocks in order to do so, any checking on a `regular file` for readability or writeability always succeeds immediately, regardless turning on nonblocking mode or not, the`read()` or `write()` calls on `regular files` always have the possibility of blocking the calling thread for an unknown amount of time.

    > Note: Per [document](http://www.remlab.net/op/nonblock.shtml) from Remlab pointed out, for reqular file,  if the system needs time to perform the I/O operation, it will put the task in non-interruptible sleep from the read or write system call. The only safe way to read data from or write data to a regular file while not blocking a task is that we need to consider creating a separate thread (or process), or using asynchronous I/O (functions whose name starts with aio_). Whether you like it or not, and even if you think multiple threads suck, there are no other options.

```
TODO, diagram
```

As above diagram illustrate, when we set a socket to be nonblocking, we are telling the kernel "when an I\/O operation that I request cannot be completed without putting the process to sleep, do not put the process to sleep, but return an error instead. The device is opened as non-blocking. This means that instead of completing an I\/O immediately, a read may return an error code indicating that the command could not be immediately satisfied \(EAGAIN or EWOULDBLOCK\). As you may feel in this sample, the difficulty with nonblocking socket calls is that there is no way of knowing when one would succeed, except by periodically trying it until it does \(a process known as “polling”\). The implication of non-blocking is that an I\/O command may not be satisfied immediately, requiring that the application make numerous calls to await completion. This can be extremely inefficient because in many cases the application must busy-wait until the data is available or attempt to do other work while the command is performed in the kernel. As also shown in Figure 3, this method can introduce latency in the I\/O because any gap between the data becoming available in the kernel and the user calling read to return it can reduce the overall data throughput.

[http:\/\/www.wangafu.net\/~nickm\/libevent-book\/01\_intro.html](http://www.wangafu.net/~nickm/libevent-book/01_intro.html)
Now that we’re using nonblocking sockets, the code above would work… but only barely. The performance will be awful, for two reasons. First, when there is no data to read on either connection the loop will spin indefinitely, using up all your CPU cycles. Second, if you try to handle more than one or two connections with this approach you’ll do a kernel call for each one, whether it has any data for you or not. So what we need is a way to tell the kernel "wait until one of these sockets is ready to give me some data, and tell me which ones are ready."

[http:\/\/blog.omega-prime.co.uk\/?p=155](http://blog.omega-prime.co.uk/?p=155)
Generally APIs providing non-blocking IO will also provide some sort of interface where you can efficiently wait for certain operations to enter a state where invoking the non-blocking IO operation will actually make some progress rather than immediately returning.

```
TODELETE

http://blog.omega-prime.co.uk/?p=155
No OS that I know of implements non-blocking IO for file IO, but support for socket IO is generally reasonable:
Non-blocking read and writes are available via the POSIX O_NONBLOCK operating mode, which can be set on file descriptors (FDs) representing sockets and FIFOs.

http://compgeom.com/~piyush/teach/4531_06/project/hell.html
It is possible to open a file (or device) in "non-blocking" mode by using the O_NONBLOCK option in the call to open. You can also set non-blocking mode on an already open file using the fcntl call. Both of these options are documented in the GNU libc documentation.

http://tinyclouds.org/iocp-links.html
Noblocking is not beatiful...., it does not support regular file

http://www.remlab.net/op/nonblock.shtml
nonblocking does not support regular file
```

### I\/O multiplexing

What is Multiplex?

I\/O Multiplexing

```
TODO, diagram
```

\(wikipedia [https:\/\/en.wikipedia.org\/wiki\/Asynchronous\_I\/O\#Signals\_.28interrupts.29](https://en.wikipedia.org/wiki/Asynchronous_I/O#Signals_.28interrupts.29)\)
Select\(\/poll\) loops\[edit\]
Available in BSD Unix, and almost anything else with a TCP\/IP protocol stack that either utilizes or is modeled after the BSD implementation. A variation on the theme of polling, a select loop uses the select system call to sleep until a condition occurs on a file descriptor \(e.g., when data is available for reading\), a timeout occurs, or a signal is received \(e.g., when a child process dies\). By examining the return parameters of the select call, the loop finds out which file descriptor has changed and executes the appropriate code. Often, for ease of use, the select loop is implemented as an event loop, perhaps using callback functions; the situation lends itself particularly well to event-driven programming.
While this method is reliable and relatively efficient, it depends heavily on the Unix paradigm that "everything is a file"; any blocking I\/O that does not involve a file descriptor will block the process. The select loop also relies on being able to involve all I\/O in the central select call; libraries that conduct their own I\/O are particularly problematic in this respect. An additional potential problem is that the select and the I\/O operations are still sufficiently decoupled that select's result may effectively be a lie: if two processes are reading from a single file descriptor \(arguably bad design\) the select may indicate the availability of read data that has disappeared by the time that the read is issued, thus resulting in blocking; if two processes are writing to a single file descriptor \(not that uncommon\) the select may indicate immediate writability yet the write may still block, because a buffer has been filled by the other process in the interim, or due to the write being too large for the available buffer or in other ways unsuitable to the recipient.
The select loop does not reach the ultimate system efficiency possible with, say, the completion queues method, because the semantics of the select call, allowing as it does for per-call tuning of the acceptable event set, consumes some amount of time per invocation traversing the selection array. This creates little overhead for user applications that might have open one file descriptor for the windowing system and a few for open files, but becomes more of a problem as the number of potential event sources grows, and can hinder development of many-client server applications, as in the C10k problem; other asynchronous methods may be noticeably more efficient in such cases. Some Unixes provide system-specific calls with better scaling; for example, epoll in Linux \(that fills the return selection array with only those event sources on which an event has occurred\), kqueue in FreeBSD, and event ports \(and \/dev\/poll\) in Solaris.
SVR3 Unix provided the poll system call. Arguably better-named than select, for the purposes of this discussion it is essentially the same thing. SVR4 Unixes \(and thus POSIX\) offer both calls.

> Multiplex model actually provide a efficent solution to select the readiness file descriptors, compare to pure nonblocking model, and then avoid waste processor cycles on the polling of each file descriptor status

### Signal driven I\/O

```
TODO, diagram
```

\(wikipedia [https:\/\/en.wikipedia.org\/wiki\/Asynchronous\_I\/O\#Signals\_.28interrupts.29](https://en.wikipedia.org/wiki/Asynchronous_I/O#Signals_.28interrupts.29)\)
Available in BSD and POSIX Unix. I\/O is issued asynchronously, and when it is completed a signal \(interrupt\) is generated. As in low-level kernel programming, the facilities available for safe use within the signal handler are limited, and the main flow of the process could have been interrupted at nearly any point, resulting in inconsistent data structures as seen by the signal handler. The signal handler is usually not able to issue further asynchronous I\/O by itself.

[http:\/\/www.linuxprogrammingblog.com\/all-about-linux-signals?page=show](http://www.linuxprogrammingblog.com/all-about-linux-signals?page=show)
It's possible to be notified of I\/O availability by a signal. It's an alternative to functions like select\(2\). It's done by setting the O\_ASYNC flag on the file descriptor. If you do so and if I\/O is available \(as select\(2\) would consider it\) a signal is sent to the process. By default it's SIGIO, but using Real-time signals is more practical and you can set up the file descriptor using fcntl\(2\) so that you get more information in siginfo\_t structure. See the links at the bottom of this article for more information. There is now a better way to do it on Linux: epoll\(7\) and similar mechanisms are available on other systems.

### signal

> In above sample, I use a sleep in the signal handler to make the sample easy to simulate the situation of a signal is executing. However, in a real-life application, this is not a suggested way, as we need to make the singal handler perform as minimal as possible.
> can Real-time signals workaround this???\([http:\/\/www.linuxprogrammingblog.com\/all-about-linux-signals?page=show](http://www.linuxprogrammingblog.com/all-about-linux-signals?page=show)\)
> 
> The reason is that signals are asynchronous, the main program may be in a very fragile state
> when a signal is processed and thus while a signal handler function executes.
> Therefore, you should avoid performing any I\/O operations or calling most library
> and system functions from signal handlers.
> A signal handler should perform the minimum work necessary to respond to the
> signal, and then return control to the main program \(or terminate the program\). In
> most cases, this consists simply of recording the fact that a signal occurred.The main
> program then checks periodically whether a signal has occurred and reacts accordingly.
> It is possible for a signal handler to be interrupted by the delivery of another signal.
> While this may sound like a rare occurrence, if it does occur, it will be very difficult to
> diagnose and debug the problem. \(This is an example of a race condition, discussed in
> Chapter 4, “Threads,” Section 4.4, “Synchronization and Critical Sections.”\) Therefore,
> you should be very careful about what your program does in a signal handler.

Above is proof of "If the same signal is delivered more than once while it is being
handled, the handler is only executed once more after it completes the original execution."

So, if we have concurrency connections, after we register the signal handler, we only can receive the previous notification, some subseqencing notifications will be ignored!

reference: [http:\/\/www.makelinux.net\/ldd3\/chp-6-sect-4](http://www.makelinux.net/ldd3/chp-6-sect-4)

6.4. Asynchronous Notification

Although the combination of blocking and nonblocking operations and the select method are sufficient for querying the device most of the time, some situations aren't efficiently managed by the techniques we've seen so far.

Let's imagine a process that executes a long computational loop at low priority but needs to process incoming data as soon as possible. If this process is responding to new observations available from some sort of data acquisition peripheral, it would like to know immediately when new data is available. This application could be written to call poll regularly to check for data, but, for many situations, there is a better way. By enabling asynchronous notification, this application can receive a signal whenever data becomes available and need not concern itself with polling.

User programs have to execute two steps to enable asynchronous notification from an input file. First, they specify a process as the "owner" of the file. When a process invokes the F\_SETOWN command using the fcntl system call, the process ID of the owner process is saved in filp-&gt;f\_owner for later use. This step is necessary for the kernel to know just whom to notify. In order to actually enable asynchronous notification, the user programs must set the FASYNC flag in the device by means of the F\_SETFL fcntl command.

After these two calls have been executed, the input file can request delivery of a SIGIO signal whenever new data arrives. The signal is sent to the process \(or process group, if the value is negative\) stored in filp-&gt;f\_owner.

For example, the following lines of code in a user program enable asynchronous notification to the current process for the stdin input file:

signal\(SIGIO, &input\_handler\); \/_ dummy sample; sigaction\(  \) is better _\/
fcntl\(STDIN\_FILENO, F\_SETOWN, getpid\(  \)\);
oflags = fcntl\(STDIN\_FILENO, F\_GETFL\);
fcntl\(STDIN\_FILENO, F\_SETFL, oflags \| FASYNC\);

### Asynchronous I\/O

```
TODO, diagram
```

### Blocking vs. Non-blocking

[http:\/\/www.programmr.com\/blogs\/difference-between-asynchronous-and-non-blocking](http://www.programmr.com/blogs/difference-between-asynchronous-and-non-blocking)

### Async vs. Sync

[http:\/\/www.programmr.com\/blogs\/difference-between-asynchronous-and-non-blocking](http://www.programmr.com/blogs/difference-between-asynchronous-and-non-blocking)
But they are also different because asynchronous calls usually involve a callback or an event,

Both terms we used in this docutment are following POXIS standard definition. 
strictly comply with the definitions provided by POSIX standard

Async: xxxxx
Sync: xxxx

In the book of Unix network programming, it is talking about the I\/O from operating system perspecitve. so we see the sample\/explanation usually from a system call, and the anaylysis put more attention on the check of how the response datagram get back from kernel space to user space. From kernel support perspecitve, it depends that fact of whether the data is carried by from kernel space to user space under background.
We can also extend those idea\/concept to a higher software layer,and check the I\/O facility we used in that layer by the similar way, i.e how the facility consumer get the response or reported by the error.
e.g: in Java world, java NIO is sync with multipluxing, java NIO2 asyncchannel api actually perform async style interactions.
The aio support for sockets in Linux seems to be shady at best with some
suggesting it is actually using readiness events at kernel level while providing
an asynchronous abstraction on completion events at application level. However
Windows seems to support this first class again via “I\/O Completion Ports”.

```
We have explorered  5 typical I/O models under unix-like OS with examples 
from operating system level, which explain the asynchronous and synchronous 
behaviors from the perspective of user space and kernel space. Actually, 
the two terms can also be adopted to higher level programming languages. 
Just keep in mind, for asynchronous I/O model, after we make the call on 
the I/O facility, the process will not in pending status, once the response 
arrive, the data gram will be transferred by underlying system component 
on background and a completion event which carrying response/error should be notified to process.
```

[http:\/\/davmac.org\/davpage\/linux\/async-io.html](http://davmac.org/davpage/linux/async-io.html)

The distinction between the two is largely a matter of operating mode \(it is the difference between performing a read operation, for example, and being notified when the data is in the application's buffer, compared to simply being notified when the data is available and asking that it be copied to the application's buffer afterwards\)

> Note: Tim Jonh's has written a very good article to explain the usage of POSIX AIO API\(see refe
>  rence [\[\]\(http:\/\/www.ibm.com\/developerworks\/linux\/library\/l-async\/\)](http://www.ibm.com/developerworks/linux/library/l-async/)[\[\]\(http:\/\/www.ibm.com\/developerworks\/linux\/library\/l-async\/\)](http://www.ibm.com/developerworks/linux/library/l-async/)[\[\]\(http:\/\/www.ibm.com\/developerworks\/linux\/library\/l-async\/\)](http://www.ibm.com/developerworks/linux/library/l-async/)[\[\]\(http:\/\/www.ibm.com\/developerworks\/linux\/library\/l-async\/\)](http://www.ibm.com/developerworks/linux/library/l-async/)[\[\]\(http:\/\/www.ibm.com\/developerworks\/linux\/library\/l-async\/\)](http://www.ibm.com/developerworks/linux/library/l-async/)[\[\]\(http:\/\/www.ibm.com\/developerworks\/linux\/library\/l-async\/\)](http://www.ibm.com/developerworks/linux/library/l-async/)[\[\]\(http:\/\/www.ibm.com\/developerworks\/linux\/library\/l-async\/\)](http://www.ibm.com/developerworks/linux/library/l-async/)[\[\]\(http:\/\/www.ibm.com\/developerworks\/linux\/library\/l-async\/\)](http://www.ibm.com/developerworks/linux/library/l-async/)[\[\]\(http:\/\/www.ibm.com\/developerworks\/linux\/library\/l-async\/\)](http://www.ibm.com/developerworks/linux/library/l-async/)[\[\]\(http:\/\/www.ibm.com\/developerworks\/linux\/library\/l-async\/\)](http://www.ibm.com/developerworks/linux/library/l-async/)[\[](http://www.ibm.com/developerworks/linux/library/l-async/)[1\]](http://www.ibm.com/developerworks/linux/library/l-async/)\), I like that article very much in general, but if the terminology of "asynchronous" can align with POSIX definition, that would be perfect.

[http:\/\/blog.omega-prime.co.uk\/?p=155](http://blog.omega-prime.co.uk/?p=155)

```
TO-DELETE
      Before we just into the docment, let's clarify some I/O pattern concepts. Thoese are really important for us to understand the whole articles.

      Blocking 
      non-blocking
      Sync
      Async

      Blocking and non-blocking is defined from API usage perspective,
      Sync and Async is defined from how the result get back to caller.
      Those patterns are common pattern and adopt to different level, so if we talking about these concept, please make sure we are talking on the same layer of things, e.g: are you talking about OS kernel, or some API or lib provided by a language.

      E.g: Netty is a async IO framework, from the Netty API, it is a non-blocking ASync IO, but if we look into the implmentation, it actually based on Java NIO, the Java NIO on linux actually is based on epoll, that is a sync-multiplexing technology, it is not a AIO from kernel perspective. anyway, when we talk about IO pattern, we need to know what layer we are talking about, In a reality, some thread-model can convert a non-block sync IO to a non-blocking async IO...
```

http:\/\/www.slideshare.net\/brendangregg\/blazing-performance-with-flame-graphs \(page-27\)

## Recap C10K problem

Finally, we get to the problem -- C10K. 15 Years ago, xxx arise C10K problem which was a big chellenge\( This situation is often called the c10k problem. With select\(\) or poll\(\), your network server will hardly perform any useful things but wasting precious CPU cycles under such high load.

C10K was raised based on condition\/situation\(both hardware and whole interenet ecosystem\) at that time..Today, C10K problem itself is not a problem anymore, people even trying to resolve the challenge of C10M, but the insights\/solution for C10K as the foundation of so many perfect softwares still enlighten us and point us to a way forward.

[http:\/\/amsekharkernel.blogspot.com\/2013\/05\/what-is-epoll-epoll-vs-select-call-and.html](http://amsekharkernel.blogspot.com/2013/05/what-is-epoll-epoll-vs-select-call-and.html)
 file:\/\/\/home\/lizh\/materials\/studyplan\/Nginx\/%E6%9E%B6%E6%9E%84%E5%B8%88%E5%AE%9E%E8%B7%B5%E6%97%A5%EF%BD%9C%E4%BB%8EC10K%E5%88%B0C10M%E9%AB%98%E6%80%A7%E8%83%BD%E7%BD%91%E7%BB%9C%E7%9A%84%E6%8E%A2%E7%B4%A2%E4%B8%8E%E5%AE%9E%E8%B7%B5%C2%A0%20\_%20%E4%B8%83%E7%89%9B%E4%BA%91%E5%AD%98%E5%82%A8.html\)... the solution:
     Reactor Pattern and Proactor Pattern
     Explain reactor apttern and proactor pattern:

```
 reactor pattern diagram (http://gngrwzrd.com/libgwrl/pod.html#reactor_pattern, http://blog.omega-prime.co.uk/?p=155)

 proactor pattern diagram(https://chamibuddhika.wordpress.com/2012/08/11/io-demystified/, http://blog.omega-prime.co.uk/?p=155)

 Those two pattern actually mapped to the two I/O pattern:

non-blocking sync IO: two things are quit important for this pattern:
    non-blocking and multiplexing

    explain what is multiplexing(http://people.eecs.berkeley.edu/~sangjin/2012/12/21/epoll-vs-kqueue.html)

non-blocking async IO

Let's explorer the situations from kernel and programming language..
```

### Thread-Based Model\(a.k.a thread-per-connection\)

```
the Apache, requer per thread hit the big problem, CPU is more and more faster than IO, waste CPU time to wait for IO response is not good, and with the request increasing, the thread/process context switch is more and more expensive. also each thread will take memory... all of these bring us to think about an other direction to resolve the problem.
Diagram of :Apache solution for high perfmance -- request per thread

This model actually is mapped to the IO pattern -- Blocking Pattern
```

### Strategy

The C10K point out the thread-base\(a.k.a process-per-connect\) disavantage which prevent us to effeciently use the compute hardware resources,  especially the processor cycles. One of most interesting solution directions is pointed out in the research is to have less threads\/processes to serve more connection. From programming models perspective, I am list them below:

Essentially, the insightful idea delivered by C10K problem lighted a way of \[1\] using less threads\/processes to serve more connections, \[2\] Reduce\(avoid\) CPU on busy-wait state for the I\/O readatity probe. how to do this? firstly, we need to unbound I\/O operation from process\/thread

#### Reactor Pattern

```
diagram needed here
```

##### nonblocking in conjunction with level-triggered readiness notification\(readiness selector nofitication,e.g: select, poll\)

both model\(2\) and mode\(3\) can be mapped to this pattern, but model\(2\)  is extremely inefficient because in many cases the application must busy-wait until the data is available or attempt to do other work while the command is perform

nonblocking + multplex well fit in this pattern, because:
\([http:\/\/davmac.org\/davpage\/linux\/async-io.html](http://davmac.org/davpage/linux/async-io.html)\)
Non-blocking mode makes it possible to continuously iterate through the interesting file descriptors and check for available input \(or check for readiness for output\) simply by attempting a read \(or write\). This technique is called polling and is problematic primarily because it needlessly consumes CPU time - that is, the program never blocks, even when no input or output is possible on any file descriptor. An event notification mechanism is needed to discover when useful reads\/writes are possible.

##### nonblocking in conjunction with edge-trigerred readiness notification\(e.g: epoll and signal notification\)

from pure theory perspective, using SIGIO signal nofication to is more efficient than synchornizced-demultiplexer\(selector\).. but...

1. Signal handler can't do heavy logic
2. Signal can not be queeued. Only handle one more pending, others will be discarded.

  ```C
  move the c signal handler sample from I/O model section to here
  ```

3. [http:\/\/davmac.org\/davpage\/linux\/async-io.html](http://davmac.org/davpage/linux/async-io.html)


Note also that SIGIO can itself be selected as the notification signal. This allows the assosicated extra data to be retrieved, however, multiple SIGIO signals will not be queued and there is no way to detect if signals have been lost, so it is necessary to treat each SIGIO as an overflow regardless. It's much better to use a real-time signal. If you do, you potentially have an asynchronous event handling scheme which in some cases may be more efficient than using poll\(\) and perhaps even epoll\(\), which will soon be discussed.

[http:\/\/www.linuxprogrammingblog.com\/all-about-linux-signals?page=show](http://www.linuxprogrammingblog.com/all-about-linux-signals?page=show) 
and 
[http:\/\/www.visolve.com\/uploads\/resources\/squidrtsignal.pdf](http://www.visolve.com/uploads/resources/squidrtsignal.pdf)
and
[http:\/\/davmac.org\/davpage\/linux\/async-io.html\#signals](http://davmac.org/davpage/linux/async-io.html#signals)
Event notification with poll
the realtime signal came earlier than epoll, epoll is a more modern api for the polling

advanced linux programming
A signal handler should perform the minimum work necessary to respond to the
signal, and then return control to the main program \(or terminate the program\). In
most cases, this consists simply of recording the fact that a signal occurred.The main
program then checks periodically whether a signal has occurred and reacts accordingly.

#### Proactor Pattern

AIO, normally used as edge-triggered completion notification, 
AIO

## Linux Kernel Support

每一大项填加一个bullets 说明

TODO: 每一个具体技术API使用上，注明是POXIS，还是BSD的，还是Linux特有的
GNU libc

As mentioned in above section, the C10K not only raise the problem out, but also points us to the possible directions from programming models perspective. So for our next step, let's take a closer look at linux kernel side, and see what linux kernel\(including standard libc\) pursued on this area during the period over years.  With these concrete OS layer fundamental contributions, we can settle down above programming model into the real-life pratical experiements.

The discusion only covers the linux operating system, as that is my personal intrests and familiar with. :-\)

### blocking socket programming

API signatures:

Simple Client:

```c
#include <stdio.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <string.h>

int main(){
  int clientSocket;
  char buffer[1024];
  struct sockaddr_in serverAddr;
  socklen_t addr_size;

  /*---- Create the socket. The three arguments are: ----*/
  /* 1) Internet domain 2) Stream socket 3) Default protocol (TCP in this case) */
  clientSocket = socket(PF_INET, SOCK_STREAM, 0);

  /*---- Configure settings of the server address struct ----*/
  /* Address family = Internet */
  serverAddr.sin_family = AF_INET;
  /* Set port number, using htons function to use proper byte order */
  serverAddr.sin_port = htons(7891);
  /* Set IP address to localhost */
  serverAddr.sin_addr.s_addr = inet_addr("127.0.0.1");
  /* Set all bits of the padding field to 0 */
  memset(serverAddr.sin_zero, '\0', sizeof serverAddr.sin_zero);  

  /*---- Connect the socket to the server using the address struct ----*/
  addr_size = sizeof serverAddr;
  connect(clientSocket, (struct sockaddr *) &serverAddr, addr_size);

  /*---- Read the message from the server into the buffer ----*/
  recv(clientSocket, buffer, 1024, 0);

  /*---- Print the received message ----*/
  printf("Data received: %s",buffer);   

  return 0;
}
```

Simple Server:

```c
#include <stdio.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <string.h>

int main(){
  int welcomeSocket, newSocket;
  char buffer[1024];
  struct sockaddr_in serverAddr;
  struct sockaddr_storage serverStorage;
  socklen_t addr_size;

  /*---- Create the socket. The three arguments are: ----*/
  /* 1) Internet domain 2) Stream socket 3) Default protocol (TCP in this case) */
  welcomeSocket = socket(PF_INET, SOCK_STREAM, 0);

  /*---- Configure settings of the server address struct ----*/
  /* Address family = Internet */
  serverAddr.sin_family = AF_INET;
  /* Set port number, using htons function to use proper byte order */
  serverAddr.sin_port = htons(7891);
  /* Set IP address to localhost */
  serverAddr.sin_addr.s_addr = inet_addr("127.0.0.1");
  /* Set all bits of the padding field to 0 */
  memset(serverAddr.sin_zero, '\0', sizeof serverAddr.sin_zero);  

  /*---- Bind the address struct to the socket ----*/
  bind(welcomeSocket, (struct sockaddr *) &serverAddr, sizeof(serverAddr));

  /*---- Listen on the socket, with 5 max connection requests queued ----*/
  if(listen(welcomeSocket,5)==0)
    printf("Listening\n");
  else
    printf("Error\n");

  /*---- Accept call creates a new socket for the incoming connection ----*/
  addr_size = sizeof serverStorage;
  newSocket = accept(welcomeSocket, (struct sockaddr *) &serverStorage, &addr_size);

  /*---- Send message to the socket of the incoming connection ----*/
  strcpy(buffer,"Hello World\n");
  send(newSocket,buffer,13,0);

  return 0;
}
```

Process-per-connection API signatures:

socket\_blocking\_multiconn \(process-per-connect model\)

```c
#include <stdio.h>
#include <stdlib.h>

#include <netdb.h>
#include <netinet/in.h>

#include <string.h>

void doprocessing (int sock);

int main( int argc, char *argv[] ) {
   int sockfd, newsockfd, portno, clilen;
   char buffer[256];
   struct sockaddr_in serv_addr, cli_addr;
   int n, pid;

   /* First call to socket() function */
   sockfd = socket(AF_INET, SOCK_STREAM, 0);

   if (sockfd < 0) {
      perror("ERROR opening socket");
      exit(1);
   }

   /* Initialize socket structure */
   bzero((char *) &serv_addr, sizeof(serv_addr));
   portno = 5500;

   serv_addr.sin_family = AF_INET;
   serv_addr.sin_addr.s_addr = INADDR_ANY;
   serv_addr.sin_port = htons(portno);

   /* Now bind the host address using bind() call.*/
   if (bind(sockfd, (struct sockaddr *) &serv_addr, sizeof(serv_addr)) < 0) {
      perror("ERROR on binding");
      exit(1);
   }

   /* Now start listening for the clients, here
      * process will go in sleep mode and will wait
      * for the incoming connection
   */

   listen(sockfd,5);
   clilen = sizeof(cli_addr);

   while (1) {
      newsockfd = accept(sockfd, (struct sockaddr *) &cli_addr, &clilen);

      if (newsockfd < 0) {
         perror("ERROR on accept");
         exit(1);
      }

      /* Create child process */
      pid = fork();

      if (pid < 0) {
         perror("ERROR on fork");
         exit(1);
      }

      if (pid == 0) {
         /* This is the client process */
         close(sockfd);
         doprocessing(newsockfd);
         exit(0);
      }
      else {
         close(newsockfd);
      }

   } /* end of while */
}

void doprocessing (int sock) {
   int n;
   char buffer[256];
   bzero(buffer,256);
   n = read(sock,buffer,255);

   if (n < 0) {
      perror("ERROR reading from socket");
      exit(1);
   }

   printf("Here is the message: %s\n",buffer);
   n = write(sock,"I got your message",18);

   if (n < 0) {
      perror("ERROR writing to socket");
      exit(1);
   }

}
```

### noblocking

API signatures:

[http:\/\/www.wangafu.net\/~nickm\/libevent-book\/01\_intro.html](http://www.wangafu.net/~nickm/libevent-book/01_intro.html)
book: TCPIP socket In C practical guide for programmer
write a sample here:

```
       TODO, sample code
```

[http:\/\/davmac.org\/davpage\/linux\/async-io.html](http://davmac.org/davpage/linux/async-io.html)

It is possible to open a file \(or device\) in "non-blocking" mode by using the O\_NONBLOCK option in the call to open. You can also set non-blocking mode on an already open file using the fcntl call. Both of these options are documented in the GNU libc documentation

> However, it is a general weakness of the technique. In general, non-blocking I\/O and the event notification mechanisms here will work with sockets and pipes, TTYs, and certain other types of device.
> A more subtle problem with non-blocking I\/O is that it generally doesn't work with regular files \(this is true on linux, even when files are opened with O\_DIRECT; possibly not on other operating systems\). That is, opening a regular file in non-blocking mode has no effect for regular files: a read will always actually read some of the file, even if the program blocks in order to do so. In some cases this may not be important, seeing as file I\/O is generally fast enough so as to not cause long blocking periods \(so long as the file is local and not on a network, or a slow medium\). However, it is a general weakness of the technique. In general, non-blocking I\/O and the event notification mechanisms here will work with sockets and pipes, TTYs, and certain other types of device.

[http:\/\/compgeom.com\/~piyush\/teach\/4531\_06\/project\/hell.html](http://compgeom.com/~piyush/teach/4531_06/project/hell.html)
A more subtle problem with non-blocking I\/O is that it generally doesn't work with regular files \(this is true on linux\). That is, opening a regular file in non-blocking mode has no effect for regular files: a read will always actually read some of the file, even if the program blocks in order to do so. In some cases this may not be important, seeing as file I\/O is generally fast enough so as to not cause long blocking periods. However, I see it as a general weakness of the technique.
Note the O\_NONBLOCK also causes the open\(\) call itself to be non-blocking for certain types of device \(modems are the primary example in the GNU libc documentation\). Unfortunately, there doesn't seem to exist a mechanism by which you can execute an open\(\) call in a truly non-blocking manner for all files.

[http:\/\/www.kegel.com\/c10k.html\#nb](http://www.kegel.com/c10k.html#nb)
Note: it's particularly important to remember that readiness notification from the kernel is only a hint; the file descriptor might not be ready anymore when you try to read from it. That's why it's important to use nonblocking mode when using readiness notification.

### Demultipluxer Technology

[https:\/\/bugzilla.kernel.org\/show\_bug.cgi?id=15272](https://bugzilla.kernel.org/show_bug.cgi?id=15272)
 [http:\/\/blog.csdn.net\/zxjcarrot\/article\/details\/32935001](http://blog.csdn.net/zxjcarrot/article/details/32935001)
 [http:\/\/www.remlab.net\/op\/nonblock.shtml](http://www.remlab.net/op/nonblock.shtml)
其实select和poll也是“不支持”对regular file进行监控的，只不过它们被设计为可以接受regular file的fd，只是默认对任何event都全部返回True。epoll在设计的时候，考虑到既然对regular file‘s fd进行polling是没意义的，干脆我就不接受这种类型的fd，所以如果你传入一个真实文件的fd给epoll，它会直接报错返回-1，并将errno设置为EPERM错误码。

源引的资料:

```
=========================================POSIX mandates that regular files always return ready for reading or
writing. IEEE Std 1003.1-2008 says, regarding the poll() interface, that Regular files shall always poll TRUE for reading and writing.
For select(), File descriptors associated with regular files shall always select
true for ready to read, ready to write, and error conditions.

The reasons for this are based on historical and modern implementations
(neither the BSDs nor Linux have an asynchronous block layer), but
regardless it's a part of the abstract interface and won't change anytime
soon even if the implementations change in a way that supports non-blocking
reads. AIO in Linux, for example, AFAIK, is still done using threads, either
preemptible userland threads or kernel work queue threads.  ===============================================What you are trying to do doesn't make any sense. 

For a socket, for example, "ready to read" can mean that there's data 
that a "read" could return without blocking. However, with a file, the 
system has no idea where in the file you'd like to read, so it cannot 
know whether that "read" could return without blocking. 

For a socket, for example, "ready to write" can mean that the other 
side has acknowledged data or enlarged the window or it can mean 
there's space in the local socket send buffer. For a file, the system 
has no idea where you might want to write in the file and system cache 
space is shared and so is unlikely to still be available by the time 
you get around to calling write. 

So even if you could add a regular file to an epoll set, there would 
be no point. If you did ever get a 'ready to read' or 'ready to write' 
indication, you would have no idea what it meant. 

DS  ============================================The problem is that non-blocking I/O isn't specified for regular files 
either. So how many bytes have to be ready for the file to be "ready 
for read". If it woke the process with just one byte ready to read, 
the process would block on the "read" for more than one byte. 

The reason 'select', 'poll', and 'epoll' work so well for sockets is 
because sockets have a well-defined non-blocking API. Generally, 
people use these functions to discover when to attempt non-blocking 
operations in designs where it's important the thread not block. 

Because no such non-blocking API exists for local files (other than 
AIO which doesn't require discovery anyway), a discovery mechanism 
wouldn't really have any use if there was one. 

So while "ready for read" could be defined for files in this way, it 
would have almost no use. A way to discover that a file had been 
modified would be much more useful, and so that is provided. 

DS  ===============================================The problem is the definition of "available". What does it mean for
data to be "available" in a regular file? Does that mean it is not
past the EOF? Does it mean that it's in cache? Or what? （因为没法界定，所以不好支持啊……）

DS ===============================================
 （试想一下你在使用普通磁盘文件时的操作，其实都是阻塞的。对于磁盘文件来说，根本不存在NON_BLOCKING模式。为什么？因为不管你想阻塞还是不想阻塞，它都需要从磁盘盘片上去一个一个字节读进来，但是磁盘的状态是没法预知的，万一你遇上一个破旧的软盘，你即使读取文件的已有部分，它还是会阻塞你的进程的，而且还是Uninterruptible Blocking！所以对于磁盘文件来说，你使用的、你用到的、你需要的都是阻塞模式，因此Linux中不支持磁盘文件的NON_BLOCKING模式，也不需要支持！）
Normal file I/O is blocking in the sense that the function will not
return, stalling the process as long as needed, until the operation
definitively succeeds or fails. It is expected that this will be
"soon", but that isn't always the case. However, it is not the typical
blocking behavior because the process is not interruptible.

DS
===============================================
```

[https:\/\/www.nginx.com\/resources\/wiki\/start\/topics\/tutorials\/optimizations\/\#](https://www.nginx.com/resources/wiki/start/topics/tutorials/optimizations/#)

Table based below information:
Event Models¶

NGINX supports the following methods of treating the connections, which can be assigned by the use directive:

select - standard method. Compiled by default, if the current platform does not have a more effective method. You can enable or disable this module by using configuration parameters --with-select\_module and --without-select\_module.
poll - standard method. Compiled by default, if the current platform does not have a more effective method. You can enable or disable this module by using configuration parameters --with-poll\_module and --without-poll\_module.
kqueue - the effective method, used on FreeBSD 4.1+, OpenBSD 2.9+, NetBSD 2.0 and MacOS X. With dual-processor machines running MacOS X using kqueue can lead to kernel panic.
epoll - the effective method, used on Linux 2.6+. In some distrubutions, like SuSE 8.2, there are patches for supporting epoll by kernel version 2.4.
rtsig - real time signals, the executable used on Linux 2.2.19+. By default no more than 1024 POSIX realtime \(queued\) signals can be outstanding in the entire system. This is insufficient for highly loaded servers; it’s therefore necessary to increase the queue size by using the kernel parameter \/proc\/sys\/kernel\/rtsig-max. However, starting with Linux 2.6.6-mm2, this parameter is no longer available, and for each process there is a separate queue of signals, the size of which is assigned by RLIMIT\_SIGPENDING. When the queue becomes overcrowded, NGINX discards it and begins processing connections using the poll method until the situation normalizes.
\/dev\/poll - the effective method, used on Solaris 7 11\/99+, HP\/UX 11.22+ \(eventport\), IRIX 6.5.15+ and Tru64 UNIX 5.1A+.

### Level-triggered Demultipluxer

```
 Explain what is multiplux(diagram file:///home/lizh/materials/studyplan/Nginx/Linux%20IO%20%E5%A4%9A%E8%B7%AF%E5%A4%8D%E7%94%A8%E6%98%AF%E4%BB%80%E4%B9%88%E6%84%8F%E6%80%9D%EF%BC%9F%20-%20Linux%20%E5%BC%80%E5%8F%91%20-%20%E7%9F%A5%E4%B9%8E.html)

 select, poll, epoll(http://people.eecs.berkeley.edu/~sangjin/2012/12/21/epoll-vs-kqueue.html)
```

#### Select\(level-triggered\):

```
 http://amsekharkernel.blogspot.com/2013/05/what-is-epoll-epoll-vs-select-call-and.html
 http://bulk.fefe.de/scalable-networking.pdf
```

```c
#include <stdio.h>
#include <string.h>   //strlen
#include <stdlib.h>
#include <errno.h>
#include <unistd.h>   //close
#include <arpa/inet.h>    //close
#include <sys/types.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <sys/time.h> //FD_SET, FD_ISSET, FD_ZERO macros

#define TRUE   1
#define FALSE  0
#define PORT 5500 

int main(int argc , char *argv[])
{
    int opt = TRUE;
    int master_socket , addrlen , new_socket , client_socket[30] , max_clients = 30 , activity, i , valread , sd;
    int max_sd;
    struct sockaddr_in address;

    char buffer[1025];  //data buffer of 1K

    //set of socket descriptors
    fd_set readfds;

    //a message
    char *message = "ECHO Daemon v1.0 \r\n";

    //initialise all client_socket[] to 0 so not checked
    for (i = 0; i < max_clients; i++) 
    {
        client_socket[i] = 0;
    }

    //create a master socket
    if( (master_socket = socket(AF_INET , SOCK_STREAM , 0)) == 0) 
    {
        perror("socket failed");
        exit(EXIT_FAILURE);
    }

    //set master socket to allow multiple connections , this is just a good habit, it will work without this
    if( setsockopt(master_socket, SOL_SOCKET, SO_REUSEADDR, (char *)&opt, sizeof(opt)) < 0 )
    {
        perror("setsockopt");
        exit(EXIT_FAILURE);
    }

    //type of socket created
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = INADDR_ANY;
    address.sin_port = htons( PORT );

    //bind the socket to localhost port 8888
    if (bind(master_socket, (struct sockaddr *)&address, sizeof(address))<0) 
    {
        perror("bind failed");
        exit(EXIT_FAILURE);
    }
    printf("Listener on port %d \n", PORT);

    //try to specify maximum of 3 pending connections for the master socket
    if (listen(master_socket, 3) < 0)
    {
        perror("listen");
        exit(EXIT_FAILURE);
    }

    //accept the incoming connection
    addrlen = sizeof(address);
    puts("Waiting for connections ...");

    while(TRUE) 
    {
        //clear the socket set
        FD_ZERO(&readfds);

        //add master socket to set
        FD_SET(master_socket, &readfds);
        max_sd = master_socket;

        //add child sockets to set
        for ( i = 0 ; i < max_clients ; i++) 
        {
            //socket descriptor
            sd = client_socket[i];

            //if valid socket descriptor then add to read list
            if(sd > 0)
                FD_SET( sd , &readfds);

            //highest file descriptor number, need it for the select function
            if(sd > max_sd)
                max_sd = sd;
        }

        //wait for an activity on one of the sockets , timeout is NULL , so wait indefinitely
        activity = select( max_sd + 1 , &readfds , NULL , NULL , NULL);

        if ((activity < 0) && (errno!=EINTR)) 
        {
            printf("select error");
        }

        //If something happened on the master socket , then its an incoming connection
        if (FD_ISSET(master_socket, &readfds)) 
        {
            if ((new_socket = accept(master_socket, (struct sockaddr *)&address, (socklen_t*)&addrlen))<0)
            {
                perror("accept");
                exit(EXIT_FAILURE);
            }

            //inform user of socket number - used in send and receive commands
            printf("New connection , socket fd is %d , ip is : %s , port : %d \n" , new_socket , inet_ntoa(address.sin_addr) , ntohs(address.sin_port));

            //send new connection greeting message
            if( send(new_socket, message, strlen(message), 0) != strlen(message) ) 
            {
                perror("send");
            }

            puts("Welcome message sent successfully");

            //add new socket to array of sockets
            for (i = 0; i < max_clients; i++) 
            {
                //if position is empty
                if( client_socket[i] == 0 )
                {
                    client_socket[i] = new_socket;
                    printf("Adding to list of sockets as %d\n" , i);

                    break;
                }
            }
        }

        //else its some IO operation on some other socket :)
        for (i = 0; i < max_clients; i++) 
        {
            sd = client_socket[i];

            if (FD_ISSET( sd , &readfds)) 
            {
                //Check if it was for closing , and also read the incoming message
                if ((valread = read( sd , buffer, 1024)) == 0)
                {
                    //Somebody disconnected , get his details and print
                    getpeername(sd , (struct sockaddr*)&address , (socklen_t*)&addrlen);
                    printf("Host disconnected , ip %s , port %d \n" , inet_ntoa(address.sin_addr) , ntohs(address.sin_port));

                    //Close the socket and mark as 0 in list for reuse
                    close( sd );
                    client_socket[i] = 0;
                }

                //Echo back the message that came in
                else
                {
                    //set the string terminating NULL byte on the end of the data read
                    buffer[valread] = '\0';
                    send(sd , buffer , strlen(buffer) , 0 );
                }
            }
        }
    }

    return 0;
} 
```

```bash
#!/bin/bash
exec 3<>/dev/tcp/localhost/5500
cat <&3 &
for i in {1..10}; do echo "hello" >&3; done
```

[http:\/\/stackoverflow.com\/questions\/11901884\/how-can-select-wait-on-regular-file-descriptors-non-sockets](http://stackoverflow.com/questions/11901884/how-can-select-wait-on-regular-file-descriptors-non-sockets)
Disk files are always ready to read \(but the read might return 0 bytes if you're already at the end of the file\), so you can't use select\(\) on a disk file to find out when new data is added to the file.

POSIX says:

File descriptors associated with regular files shall always select true for ready to read, ready to write, and error conditions.
Also, as cnicutar pointed out in a now-deleted post, in general, you have to initialize the FD\_SET on each iteration. In your code, you are monitoring one fd, and that fd is always ready, so the FD\_SET is not in fact changing. However, if you have 5 decriptors to monitor, and select detects that only one is ready, then on the next iteration, only that one descriptor would be monitored \(unless you reset the FD\_SET\). This makes using select tricky.

#### Poll\(level-triggered\):

[https:\/\/bugzilla.kernel.org\/show\_bug.cgi?id=15272](https://bugzilla.kernel.org/show_bug.cgi?id=15272)
Regular files do not support the linux -&gt;poll\(\) file operation.
If you want to wait for events on regular files, you need to use AIO+eventfd+epoll.

```
 http://amsekharkernel.blogspot.com/2013/05/what-is-epoll-epoll-vs-select-call-and.html
 http://bulk.fefe.de/scalable-networking.pdf
```

```c
#include <stdio.h>
#include <stdlib.h>
#include <sys/ioctl.h>
#include <sys/poll.h>
#include <sys/socket.h>
#include <sys/time.h>
#include <netinet/in.h>
#include <errno.h>

#define SERVER_PORT  5500

#define TRUE             1
#define FALSE            0

main (int argc, char *argv[])
{
  int    len, rc, on = 1;
  int    listen_sd = -1, new_sd = -1;
  int    desc_ready, end_server = FALSE, compress_array = FALSE;
  int    close_conn;
  char   buffer[80];
  struct sockaddr_in   addr;
  int    timeout;
  struct pollfd fds[200];
  int    nfds = 1, current_size = 0, i, j;

  /*************************************************************/
  /* Create an AF_INET stream socket to receive incoming       */
  /* connections on                                            */
  /*************************************************************/
  listen_sd = socket(AF_INET, SOCK_STREAM, 0);
  if (listen_sd < 0)
  {
    perror("socket() failed");
    exit(-1);
  }

  /*************************************************************/
  /* Allow socket descriptor to be reuseable                   */
  /*************************************************************/
  rc = setsockopt(listen_sd, SOL_SOCKET,  SO_REUSEADDR,
                  (char *)&on, sizeof(on));
  if (rc < 0)
  {
    perror("setsockopt() failed");
    close(listen_sd);
    exit(-1);
  }

  /*************************************************************/
  /* Set socket to be nonblocking. All of the sockets for    */
  /* the incoming connections will also be nonblocking since  */
  /* they will inherit that state from the listening socket.   */
  /*************************************************************/
  rc = ioctl(listen_sd, FIONBIO, (char *)&on);
  if (rc < 0)
  {
    perror("ioctl() failed");
    close(listen_sd);
    exit(-1);
  }

  /*************************************************************/
  /* Bind the socket                                           */
  /*************************************************************/
  memset(&addr, 0, sizeof(addr));
  addr.sin_family      = AF_INET;
  addr.sin_addr.s_addr = htonl(INADDR_ANY);
  addr.sin_port        = htons(SERVER_PORT);
  rc = bind(listen_sd,
            (struct sockaddr *)&addr, sizeof(addr));
  if (rc < 0)
  {
    perror("bind() failed");
    close(listen_sd);
    exit(-1);
  }

  /*************************************************************/
  /* Set the listen back log                                   */
  /*************************************************************/
  rc = listen(listen_sd, 32);
  if (rc < 0)
  {
    perror("listen() failed");
    close(listen_sd);
    exit(-1);
  }

  /*************************************************************/
  /* Initialize the pollfd structure                           */
  /*************************************************************/
  memset(fds, 0 , sizeof(fds));

  /*************************************************************/
  /* Set up the initial listening socket                        */
  /*************************************************************/
  fds[0].fd = listen_sd;
  fds[0].events = POLLIN;
  /*************************************************************/
  /* Initialize the timeout to 3 minutes. If no               */
  /* activity after 3 minutes this program will end.           */
  /* timeout value is based on milliseconds.                   */
  /*************************************************************/
  timeout = (3 * 60 * 1000);

  /*************************************************************/
  /* Loop waiting for incoming connects or for incoming data   */
  /* on any of the connected sockets.                          */
  /*************************************************************/
  do
  {
    /***********************************************************/
    /* Call poll() and wait 3 minutes for it to complete.      */
    /***********************************************************/
    printf("Waiting on poll()...\n");
    rc = poll(fds, nfds, timeout);

    /***********************************************************/
    /* Check to see if the poll call failed.                   */
    /***********************************************************/
    if (rc < 0)
    {
      perror("  poll() failed");
      break;
    }

    /***********************************************************/
    /* Check to see if the 3 minute time out expired.          */
    /***********************************************************/
    if (rc == 0)
    {
      printf("  poll() timed out.  End program.\n");
      break;
    }


    /***********************************************************/
    /* One or more descriptors are readable.  Need to          */
    /* determine which ones they are.                          */
    /***********************************************************/
    current_size = nfds;
    for (i = 0; i < current_size; i++)
    {
      /*********************************************************/
      /* Loop through to find the descriptors that returned    */
      /* POLLIN and determine whether it's the listening       */
      /* or the active connection.                             */
      /*********************************************************/
      if(fds[i].revents == 0)
        continue;

      /*********************************************************/
      /* If revents is not POLLIN, it's an unexpected result,  */
      /* log and end the server.                               */
      /*********************************************************/
      if(fds[i].revents != POLLIN)
      {
        printf("  Error! revents = %d\n", fds[i].revents);
        end_server = TRUE;
        break;

      }
      if (fds[i].fd == listen_sd)
      {
        /*******************************************************/
        /* Listening descriptor is readable.                   */
        /*******************************************************/
        printf("  Listening socket is readable\n");

        /*******************************************************/
        /* Accept all incoming connections that are            */
        /* queued up on the listening socket before we         */
        /* loop back and call poll again.                      */
        /*******************************************************/
        do
        {
          /*****************************************************/
          /* Accept each incoming connection. If              */
          /* accept fails with EWOULDBLOCK, then we            */
          /* have accepted all of them. Any other             */
          /* failure on accept will cause us to end the        */
          /* server.                                           */
          /*****************************************************/
          new_sd = accept(listen_sd, NULL, NULL);
          if (new_sd < 0)
          {
            if (errno != EWOULDBLOCK)
            {
              perror("  accept() failed");
              end_server = TRUE;
            }
            break;
          }

          /*****************************************************/
          /* Add the new incoming connection to the            */
          /* pollfd structure                                  */
          /*****************************************************/
          printf("  New incoming connection - %d\n", new_sd);
          fds[nfds].fd = new_sd;
          fds[nfds].events = POLLIN;
          nfds++;

          /*****************************************************/
          /* Loop back up and accept another incoming          */
          /* connection                                        */
          /*****************************************************/
        } while (new_sd != -1);
      }

      /*********************************************************/
      /* This is not the listening socket, therefore an        */
      /* existing connection must be readable                  */
      /*********************************************************/

      else
      {
        printf("  Descriptor %d is readable\n", fds[i].fd);
        close_conn = FALSE;
        /*******************************************************/
        /* Receive all incoming data on this socket            */
        /* before we loop back and call poll again.            */
        /*******************************************************/

        do
        {
          /*****************************************************/
          /* Receive data on this connection until the         */
          /* recv fails with EWOULDBLOCK. If any other        */
          /* failure occurs, we will close the                 */
          /* connection.                                       */
          /*****************************************************/
          rc = recv(fds[i].fd, buffer, sizeof(buffer), 0);
          if (rc < 0)
          {
            if (errno != EWOULDBLOCK)
            {
              perror("  recv() failed");
              close_conn = TRUE;
            }
            break;
          }

          /*****************************************************/
          /* Check to see if the connection has been           */
          /* closed by the client                              */
          /*****************************************************/
          if (rc == 0)
          {
            printf("  Connection closed\n");
            close_conn = TRUE;
            break;
          }

          /*****************************************************/
          /* Data was received                                 */
          /*****************************************************/
          len = rc;
          printf("  %d bytes received\n", len);

          /*****************************************************/
          /* Echo the data back to the client                  */
          /*****************************************************/
          rc = send(fds[i].fd, buffer, len, 0);
          if (rc < 0)
          {
            perror("  send() failed");
            close_conn = TRUE;
            break;
          }

        } while(TRUE);

        /*******************************************************/
        /* If the close_conn flag was turned on, we need       */
        /* to clean up this active connection. This           */
        /* clean up process includes removing the              */
        /* descriptor.                                         */
        /*******************************************************/
        if (close_conn)
        {
          close(fds[i].fd);
          fds[i].fd = -1;
          compress_array = TRUE;
        }


      }  /* End of existing connection is readable             */
    } /* End of loop through pollable descriptors              */

    /***********************************************************/
    /* If the compress_array flag was turned on, we need       */
    /* to squeeze together the array and decrement the number  */
    /* of file descriptors. We do not need to move back the    */
    /* events and revents fields because the events will always*/
    /* be POLLIN in this case, and revents is output.          */
    /***********************************************************/
    if (compress_array)
    {
      compress_array = FALSE;
      for (i = 0; i < nfds; i++)
      {
        if (fds[i].fd == -1)
        {
          for(j = i; j < nfds; j++)
          {
            fds[j].fd = fds[j+1].fd;
          }
          nfds--;
        }
      }
    }

  } while (end_server == FALSE); /* End of serving running.    */

  /*************************************************************/
  /* Clean up all of the sockets that are open                  */
  /*************************************************************/
  for (i = 0; i < nfds; i++)
  {
    if(fds[i].fd >= 0)
      close(fds[i].fd);
  }
}
```

```bash
#!/bin/bash
exec 3<>/dev/tcp/localhost/5500
cat <&3 &
for i in {1..10}; do echo "hello" >&3; done
```

sample-2

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <fcntl.h>
#include <unistd.h>
#include <sys/types.h>
#include <poll.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <arpa/inet.h>
#include <sys/time.h>


/* our defines */
#define PORT             (5500)
#define MAXBUFF          (1024)
#define MAX_CONN         (16)
#define TIMEOUT          (1024 * 1024)
#define MY_MAX(a,b)      (a = (a > b) ? a : b )
#define POLL_ERR         (-1)
#define POLL_EXPIRE      (0)

int main(int argc, char **argv)
{
    int i, j, max = 0, sfds[MAX_CONN], afd;
    size_t len;
    fd_set list;
    char buff[MAXBUFF];
    struct sockaddr_in sock[MAX_CONN];
    struct pollfd pfds[MAX_CONN];

    /* initialize our buffer */
    memset(buff, 0, MAXBUFF);

    /*
     * We will loop through each file descriptor. First,
     * we will create a socket bind to it and then call 
     * listen. If we get and error we simply exit, 
     * which is fine for demo code, but not good in the
     * real world where errors should be handled properly. 
     */
    for( i = 0; i < MAX_CONN; i++ )
    {
        /* check to see that we can create them */
        if( (sfds[i] = socket(AF_INET, SOCK_STREAM, 0)) < 0 )
        {
            perror("Cannot create socket");
            exit(1);
        }

        /* now fill out the socket stuctures */
        memset(&sock[i], 0, sizeof(struct sockaddr_in));
        sock[i].sin_family = AF_INET;
        sock[i].sin_port = htons(PORT + i);
        len = INADDR_ANY;
        memset(&sock[i].sin_addr, len, sizeof(struct in_addr));

        /* Now bind to the socket    */
        if( bind(sfds[i], (struct sockaddr *) &sock[i], sizeof(struct sockaddr_in)) < 0 )
        {
            perror("Cannot bind to the socket");
            exit(1);
        }

        /* set our options */
        if( setsockopt(sfds[i], SOL_SOCKET, SO_REUSEADDR, &j, sizeof(int)) < 0 )
        {
            perror("Cannot set socket options \n");
        }

        /* set the socket to the listen state */
        if( listen(sfds[i], 5) < 0 )
        {
            perror("Failed to listen on the socket \n");
        }

        /* now set our pollfd struct */
        pfds[i].fd = sfds[i];
        pfds[i].events = POLLIN ;

    }/* for */

    /*
     * Our main loop. Note, with the poll function we do 
     * not need to modify our structure before we call 
     * poll again. Also note that the overall function
     * is much easier to implement over select.   
     */
    while( 1 )
    {

        /*
         * Now call poll. When poll returns, one of 
         * the three conditions will be true:
         * I)   The timeout has expired
         * II)  The poll call had an error
         * III) We have a socket ready to accept
         */
        j = poll(pfds, (unsigned int)MAX_CONN, TIMEOUT);
        switch( j )
        {
            case POLL_EXPIRE:
                printf("Timeout has expired !\n");
                break;                                                    

            case POLL_ERR:
                perror("Error on poll");

            default:   
                /* 
                 * Now we have to loop through each descriptor to
                 * see which is ready to accept. We will know if 
                 * the POLLIN bit is set on this descriptor that this
                 * descriptor is ready to use. 
                 */
                for( i =0; i < MAX_CONN; i++ )
                {
                    if( pfds[i].revents & POLLIN )
                    {
                        /*
                         * We now have to accept the connection and then
                         * echo back what is written.
                         */
                        printf("We have a connection \n");
                        len = sizeof(struct sockaddr_in);
                        afd = accept(sfds[i], (struct sockaddr *)&sock[i], &len);
                        len = read(afd, buff, MAXBUFF);
                        write(afd, buff, len +1);
                        printf("Echoing back:\n %s \n");
                        /* close(afd);
                    }

                } /* for */

        } /* switch */

    }/* while(1) */

    /* FIN */
    return(0);

} /* main */
```

### Edge-triggered Demultipluxer

#### Standard Signal - "SIGIO" noitfication \(standard sigal way mentioned in book, TCPIP Sockets In C practical Guide\)

what is standard signal
 :

```c
#include <signal.h>
#include <stdio.h>
#include <string.h>
#include <sys/types.h>
#include <unistd.h>

sig_atomic_t sigusr1_count = 0;

void handler (int signal_number)
{
  printf ("SIGUSR1 Handler Enter\n");
  ++sigusr1_count;
  sleep(3);
  printf ("SIGUSR1 Handler End\n");
}

int main ()
{
  struct sigaction sa;
  memset (&sa, 0, sizeof (sa));
  sa.sa_handler = &handler;
  sigaction (SIGUSR1, &sa, NULL);

  while(1 > 0)
  {
    printf ("SIGUSR1 was raised %d times\n", sigusr1_count);
    sleep(1);
  }
  return 0;
}

```

Run the command below

```bash
for i in {1..10}; do kill -s USR1 <pid>; done
```

```console
SIGUSR1 was raised 0 times
SIGUSR1 Handler Enter
SIGUSR1 Handler End
SIGUSR1 Handler Enter
SIGUSR1 Handler End
SIGUSR1 was raised 2 times
```

Below is an example to leverage SIGIO signal for readiness notification based on UDP protocol

> Linux System programming 2nd edition
> O\_ASYNC
> A signal \( SIGIO by default\) will be generated when the specified file becomes read‐
> able or writable. This flag is available only for FIFOs, pipes, sockets, and terminals,
> not for regular files.

```c
#include <stdio.h>      /* for printf() and fprintf() */
#include <sys/socket.h> /* for socket(), bind, and connect() */
#include <arpa/inet.h>  /* for sockaddr_in and inet_ntoa() */
#include <stdlib.h>     /* for atoi() and exit() */
#include <string.h>     /* for memset() */
#include <unistd.h>     /* for close() and getpid() */
#include <fcntl.h>      /* for fcntl() */
#include <sys/file.h>   /* for O_NONBLOCK and FASYNC */
#include <signal.h>     /* for signal() and SIGALRM */
#include <errno.h>      /* for errno */

#define ECHOMAX 255     /* Longest string to echo */

void DieWithError(char *errorMessage);  /* Error handling function */
void UseIdleTime();                     /* Function to use idle time */
void SIGIOHandler(int signalType);      /* Function to handle SIGIO */

int sock;                        /* Socket -- GLOBAL for signal handler */

int main(int argc, char *argv[])
{
    struct sockaddr_in echoServAddr; /* Server address */
    unsigned short echoServPort;     /* Server port */
    struct sigaction handler;        /* Signal handling action definition */

    /* Test for correct number of parameters */
    if (argc != 2)
    {
        fprintf(stderr,"Usage:  %s <SERVER PORT>\n", argv[0]);
        exit(1);
    }

    echoServPort = atoi(argv[1]);  /* First arg:  local port */

    /* Create socket for sending/receiving datagrams */
    if ((sock = socket(PF_INET, SOCK_DGRAM, IPPROTO_UDP)) < 0)
        DieWithError("socket() failed");

    /* Set up the server address structure */
    memset(&echoServAddr, 0, sizeof(echoServAddr));   /* Zero out structure */
    echoServAddr.sin_family = AF_INET;                /* Internet family */
    echoServAddr.sin_addr.s_addr = htonl(INADDR_ANY); /* Any incoming interface */
    echoServAddr.sin_port = htons(echoServPort);      /* Port */

    /* Bind to the local address */
    if (bind(sock, (struct sockaddr *) &echoServAddr, sizeof(echoServAddr)) < 0)
        DieWithError("bind() failed");

    /* Set signal handler for SIGIO */
    handler.sa_handler = SIGIOHandler;
    /* Create mask that mask all signals */
    if (sigfillset(&handler.sa_mask) < 0) 
        DieWithError("sigfillset() failed");
    /* No flags */
    handler.sa_flags = 0;

    if (sigaction(SIGIO, &handler, 0) < 0)
        DieWithError("sigaction() failed for SIGIO");

    /* We must own the socket to receive the SIGIO message */
    if (fcntl(sock, F_SETOWN, getpid()) < 0)
        DieWithError("Unable to set process owner to us");

    /* Arrange for nonblocking I/O and SIGIO delivery */
    if (fcntl(sock, F_SETFL, O_NONBLOCK | FASYNC) < 0)
        DieWithError("Unable to put client sock into non-blocking/async mode");

    /* Go off and do real work; echoing happens in the background */

    for (;;)
        UseIdleTime();

    /* NOTREACHED */
}

void UseIdleTime()
{
    printf(".\n");
    sleep(3);     /* 3 seconds of activity */
}

void SIGIOHandler(int signalType)
{
    struct sockaddr_in echoClntAddr;  /* Address of datagram source */
    unsigned int clntLen;             /* Address length */
    int recvMsgSize;                  /* Size of datagram */
    char echoBuffer[ECHOMAX];         /* Datagram buffer */

    do  /* As long as there is input... */
    {
        /* Set the size of the in-out parameter */
        clntLen = sizeof(echoClntAddr);

        if ((recvMsgSize = recvfrom(sock, echoBuffer, ECHOMAX, 0,
               (struct sockaddr *) &echoClntAddr, &clntLen)) < 0)
        {
            /* Only acceptable error: recvfrom() would have blocked */
            if (errno != EWOULDBLOCK)  
                DieWithError("recvfrom() failed");
        }
        else
        {
            printf("Handling client %s\n", inet_ntoa(echoClntAddr.sin_addr));

            if (sendto(sock, echoBuffer, recvMsgSize, 0, (struct sockaddr *) 
                  &echoClntAddr, sizeof(echoClntAddr)) != recvMsgSize)
                DieWithError("sendto() failed");
        }
    }  while (recvMsgSize >= 0);
    /* Nothing left to receive */
}

void DieWithError(char *errorMessage)
{
    perror(errorMessage);
    exit(1);
}
```

Start the upd server on localhost:5500, and then test the server with below script:

```bash
#!/bin/bash
exec 3<>/dev/tcp/localhost/5500
cat <&3 &
for i in {1..10}; do echo "hello" >&3; done
```

\(TCP Socket In C Pratical Guide for programers\)
It is important to realize that signals are not queued—a signal is
either pending or it is not. If the same signal is delivered more than once while it is being
handled, the handler is only executed once more after it completes the original execution.

TODO, if we turn on two port in one thread, and the signal handler is busy with port-1 message handling, can it receive message from port-2 via the signal handler way?

[https:\/\/github.com\/angrave\/SystemProgramming\/wiki\/Signals,-Part-2:-Pending-Signals-and-Signal-Masks](https://github.com/angrave/SystemProgramming/wiki/Signals,-Part-2:-Pending-Signals-and-Signal-Masks)

[http:\/\/stackoverflow.com\/questions\/5285414\/signal-queuing-in-c](http://stackoverflow.com/questions/5285414/signal-queuing-in-c)
   What happens is the following:

First signal received, namely SIGUSR1, handler is called and is running
Second signal received, since handler from nr1 is still running, the signal nr2 gets pending and blocked.
Third signal received, since handler from nr1 is still running, the signal 3 gets discarded.
Fourth, fifth...etc signal of the same type as the signal nr1 are discarded.
Once signal handler is done with signal nr1, it will process signal nr2, and then signal handler will process the SIGUSR2.

Basically, pending signals of the same type are not queued, but discarded. And no, there is no easy way to "burst" send signals that way. One always assumes that there can be several signals that are discarded, and tries to let the handler do the work of cleaning and finding out what to do \(such as reaping children, if all children die at the same time\).

[http:\/\/davmac.org\/davpage\/linux\/async-io.html\#signals](http://davmac.org/davpage/linux/async-io.html#signals)
Of the notification methods, sending a signal would seem at the outset to be the only appropriate choice when large amounts of concurrent I\/O are taking place. Although realtime signals could be used, there is a potential for signal buffer overflow which means signals could be lost; furthermore there is no notification at all of such overflow \(one would think raising SIGIO in this case would be a good idea, but no, POSIX doesn't specify it, and Glibc doesn't do it\). What Glibc does do is set an error on the AIO control block so that if you happen to check, you will see an error. Of course, you never will check because you'll never receive any notification of completion.
To use AIO with signal notifications reliably then, you need to check each and every AIO control block that is associated with a particular signal whenever that signal is received. For realtime signals it means that the signal queue should be drained before this is performed, to avoid redundant checking. It would be possible to use a range of signals and distribute the control blocks to them, which would limit the amount of control blocks to check per signal received; however, it's clear that ultimately this technique is not suitable for large amounts of highly concurrent I\/O.

#### Realtime Signal Notification - "F\_SETSIG" signal

[http:\/\/www.masterraghu.com\/subjects\/np\/introduction\/unix\_network\_programming\_v1.3\/ch05lev1sec8.html](http://www.masterraghu.com/subjects/np/introduction/unix_network_programming_v1.3/ch05lev1sec8.html)
That is, by default, Unix signals are not queued. We will see an example of this in the next section. The POSIX real-time standard, 1003.1b, defines some reliable signals that are queued, but we do not use them in this text.

The POSIX specification defines so called real-time signals and Linux supports it\([http:\/\/www.linuxprogrammingblog.com\/all-about-linux-signals?page=show](http://www.linuxprogrammingblog.com/all-about-linux-signals?page=show)\)
Real-Time signal testing:

```c
#include <signal.h>
#include <stdio.h>
#include <string.h>
#include <sys/types.h>
#include <unistd.h>

sig_atomic_t sigusr1_count = 0;

void handler (int signal_number)
{
  printf ("SIGRTMIN+10 Handler Enter\n");
  ++sigusr1_count;
  sleep(3);
  printf ("SIGRTMIN+10 Handler Exit\n");
}

int main ()
{
  struct sigaction sa; 
  memset (&sa, 0, sizeof (sa));
  sa.sa_handler = &handler;
  sigaction (SIGRTMIN+10, &sa, NULL);

  while(1 > 0)  
  {
    printf ("SIGRTMIN+10 was raised %d times\n", sigusr1_count);
    sleep(1);
  }

  return 0;
}

```

run the command below:

```bash
for i in {1..10}; do kill -44 `pgrep rt_signal_test`; done
```

result:

```console
SIGRTMIN+10 was raised 0 times
SIGRTMIN+10 Handler Enter
SIGRTMIN+10 Handler Exit
SIGRTMIN+10 Handler Enter
SIGRTMIN+10 Handler Exit
SIGRTMIN+10 Handler Enter
SIGRTMIN+10 Handler Exit
SIGRTMIN+10 Handler Enter
SIGRTMIN+10 Handler Exit
SIGRTMIN+10 Handler Enter
SIGRTMIN+10 Handler Exit
SIGRTMIN+10 Handler Enter
SIGRTMIN+10 Handler Exit
SIGRTMIN+10 Handler Enter
SIGRTMIN+10 Handler Exit
SIGRTMIN+10 Handler Enter
SIGRTMIN+10 Handler Exit
SIGRTMIN+10 Handler Enter
SIGRTMIN+10 Handler Exit
SIGRTMIN+10 Handler Enter
SIGRTMIN+10 Handler Exit
SIGRTMIN+10 was raised 10 times
```

The 2.4 linux kernel can deliver socket readiness events via a particular realtime signal. Here's how to turn this behavior on:

[http:\/\/bulk.fefe.de\/scalable-networking.pdf](http://bulk.fefe.de/scalable-networking.pdf)
[http:\/\/www.kegel.com\/c10k.html\#nb.sigio](http://www.kegel.com/c10k.html#nb.sigio)
[http:\/\/www.freebsd.org\/cgi\/man.cgi?query=socket&apropos=0&sektion=7&manpath=SuSE+Linux%2Fi386+11.0&format=ascii](http://www.freebsd.org/cgi/man.cgi?query=socket&apropos=0&sektion=7&manpath=SuSE+Linux%2Fi386+11.0&format=ascii)
[http:\/\/www.visolve.com\/uploads\/resources\/squidrtsignal.pdf](http://www.visolve.com/uploads/resources/squidrtsignal.pdf)
[http:\/\/www.lxway.com\/4444140926.htm](http://www.lxway.com/4444140926.htm)
[http:\/\/davmac.org\/davpage\/linux\/async-io.html\#signals](http://davmac.org/davpage/linux/async-io.html#signals)

```c
int sigio_add_fd(int fd) {
  static const int signum=SIGRTMIN+1;
  static pid_t mypid=0;
  if (!mypid) mypid=getpid();
  fcntl(fd,F_SETOWN,mypid);
  fcntl(fd,F_SETSIG,signum);
  fcntl(fd,F_SETFL,fcntl(fd,F_GETFL)|O_NONBLOCK|O_ASYNC);
}

int sigio_rm_fd(struct sigio* s,int fd) {
  fcntl(fd,F_SETFL,fcntl(fd,F_GETFL)&(~O_ASYNC));
}
```

```c
for (;;) {
  timeout.tv_sec=0;
  timeout.tv_nsec=10000;
  switch (r=sigtimedwait(&s.ss,&info,&timeout)) {
    case -1: if (errno!=EAGAIN) error("sigtimedwait");
    case SIGIO: puts("SIGIO queue overflow!"); return 1;
  }
  if (r==signum) handle_io(info.si_fd,info.si_band);
}
```

Below is an example to use `F_SETSIG` to monitor a file system directory

```c
#define _GNU_SOURCE
#include <fcntl.h>
#include <signal.h>
#include <stdio.h>
#include <unistd.h>

/* For error handling */
#include <stdlib.h>
#include <errno.h>
#include <error.h>

static volatile int event_fd;

static void handler(int sig, siginfo_t *si, void *data)
{
    event_fd = si->si_fd;
}

int main(int argc, char *argv[])
{
    struct sigaction sa;
    int fd;

if(argc < 2)
    error(EXIT_FAILURE, 0, "missing argument");

    sa.sa_sigaction = handler;
    sigemptyset(&sa.sa_mask);
    sa.sa_flags = SA_SIGINFO;
    sigaction(SIGRTMIN + 1, &sa, NULL);

    if((fd = open(argv[1], O_RDONLY)) < 0)
        error(EXIT_FAILURE, errno, "failed to open '%s'", argv[1]);

    if(fcntl(fd, F_SETSIG, SIGRTMIN + 1) < 0)
         error(EXIT_FAILURE, errno, "failed to set dnotify signal");

    if(fcntl(fd, F_NOTIFY, DN_MODIFY|DN_CREATE|DN_DELETE|DN_MULTISHOT))
    error(EXIT_FAILURE, errno, 
              "failed to register notification for '%s'", argv[1]);

    while (1) {
        pause();
        printf("event occured for fd=%d\n", event_fd);
    }
}

```

compile the source and run it as below:

```bash

./folder_monitor /home/lizh/tmp
touch /home/lizh/tmp/tmp.txt 
```

Explain from [http:\/\/davmac.org\/davpage\/linux\/async-io.html\#signals](http://davmac.org/davpage/linux/async-io.html#signals)

File descriptors can be set to generate a signal when an I\/O readiness event occurs on them - except for those which refer to regular files \(which should not be surprising by now\). This allows using sleep\(\), pause\(\) or sigsuspend\(\) to wait for both signals and I\/O readiness events, rather than using select\(\)\/poll\(\). The GNU libc documentation has some information on using SIGIO. It tells how you can use the F\_SETOWN argument to fcntl\(\) in order to specify which process should recieve the SIGIO signal for a given file descriptor. However, it does not mention that on linux you can also use fcntl\(\) with F\_SETSIG to specify an alternative signal, including a realtime signal. Usage is as follows:

fcntl\(fd, F\_SETSIG, signum\);

... where fd is the file descriptor and signum is the signal number you want to use. Setting signum to 0 restores the default behaviour \(send SIGIO\). Setting it to non-zero has the effect of causing the specified signal to be queued when an I\/O readiness event occurs, if the specified signal is a non-realtime signal which is already pending \(? I need to check this - didn't I mean if it is a realtime signal?--难道我不是说如果这是一个realtime信号吗？\). If the signal cannot be queued a SIGIO is sent in the traditional manner.

[http:\/\/www.visolve.com\/uploads\/resources\/squidrtsignal.pdf](http://www.visolve.com/uploads/resources/squidrtsignal.pdf)
[http:\/\/www.lxway.com\/4444140926.htm](http://www.lxway.com/4444140926.htm)

RealTime  signals  have  not  achieved 
widespread  use  because  of 
difficulties  in  use  for  application  writers

[https:\/\/en.wikipedia.org\/wiki\/Asynchronous\_I\/O\#Signals\_.28interrupts.29](https://en.wikipedia.org/wiki/Asynchronous_I/O#Signals_.28interrupts.29)
The signal approach, though relatively simple to implement within the OS, brings to the application program the unwelcome baggage associated with writing an operating system's kernel interrupt system. Its worst characteristic is that every blocking \(synchronous\) system call is potentially interruptible; the programmer must usually incorporate retry code at each call.

[https:\/\/www.nginx.com\/resources\/wiki\/start\/topics\/tutorials\/optimizations\/\#](https://www.nginx.com/resources/wiki/start/topics/tutorials/optimizations/#)
rtsig - real time signals, the executable used on Linux 2.2.19+. By default no more than 1024 POSIX realtime \(queued\) signals can be outstanding in the entire system. This is insufficient for highly loaded servers; it’s therefore necessary to increase the queue size by using the kernel parameter \/proc\/sys\/kernel\/rtsig-max. However, starting with Linux 2.6.6-mm2, this parameter is no longer available, and for each process there is a separate queue of signals, the size of which is assigned by RLIMIT\_SIGPENDING. When the queue becomes overcrowded, NGINX discards it and begins processing connections using the poll method until the situation normalizes.

在基于 Linux 的多线程应用中，对于因为程序逻辑需要而产生的信号，可考虑调用 sigwait（）使用同步模型进行处理
[https:\/\/www.ibm.com\/developerworks\/cn\/linux\/l-cn-signalsec\/](https://www.ibm.com/developerworks/cn/linux/l-cn-signalsec/)

```c
#include <signal.h>
#include <errno.h>
#include <pthread.h>
#include <unistd.h>
#include <sys/types.h>

void sig_handler(int signum)
{
    printf("Receive signal. %d\n", signum);
}

void* sigmgr_thread()
{
    sigset_t   waitset, oset;
    int        sig;
    int        rc;
    pthread_t  ppid = pthread_self();

    pthread_detach(ppid);

    sigemptyset(&waitset);
    sigaddset(&waitset, SIGRTMIN);
    sigaddset(&waitset, SIGRTMIN+2);
    sigaddset(&waitset, SIGRTMAX);
    sigaddset(&waitset, SIGUSR1);
    sigaddset(&waitset, SIGUSR2);

    while (1)  {
        rc = sigwait(&waitset, &sig);
        if (rc != -1) {
            sig_handler(sig);
        } else {
            printf("sigwaitinfo() returned err: %d; %s\n", errno, strerror(errno));
        }
    }
}


int main()
{
    sigset_t bset, oset;
    int             i;
    pid_t           pid = getpid();
    pthread_t       ppid;

    sigemptyset(&bset);
    sigaddset(&bset, SIGRTMIN);
    sigaddset(&bset, SIGRTMIN+2);
    sigaddset(&bset, SIGRTMAX);
    sigaddset(&bset, SIGUSR1);
    sigaddset(&bset, SIGUSR2);

    if (pthread_sigmask(SIG_BLOCK, &bset, &oset) != 0)
        printf("!! Set pthread mask failed\n");

    kill(pid, SIGRTMAX);
    kill(pid, SIGRTMAX);
    kill(pid, SIGRTMIN+2);
    kill(pid, SIGRTMIN);
    kill(pid, SIGRTMIN+2);
    kill(pid, SIGRTMIN);
    kill(pid, SIGUSR2);
    kill(pid, SIGUSR2);
    kill(pid, SIGUSR1);
kill(pid, SIGUSR1);

    // Create the dedicated thread sigmgr_thread() which will handle signals synchronously
    pthread_create(&ppid, NULL, sigmgr_thread, NULL);

    sleep(10);

    exit (0);
}
```

```c
#include <signal.h>
#include <errno.h>
#include <pthread.h>
#include <unistd.h>
#include <sys/types.h>

void sig_handler(int signum)
{
    static int j = 0;
    static int k = 0;
    pthread_t  sig_ppid = pthread_self(); 
    // used to show which thread the signal is handled in.

    if (signum == SIGUSR1) {
        printf("thread %d, receive SIGUSR1 No. %d\n", sig_ppid, j);
        j++;
    //SIGRTMIN should not be considered constants from userland, 
    //there is compile error when use switch case
    } else if (signum == SIGRTMIN) {
        printf("thread %d, receive SIGRTMIN No. %d\n", sig_ppid, k);
        k++;
    }
}

void* worker_thread()
{
    pthread_t  ppid = pthread_self();
    pthread_detach(ppid);
    while (1) {
        printf("I'm thread %d, I'm alive\n", ppid);
        sleep(10);
    }
}

void* sigmgr_thread()
{
    sigset_t   waitset, oset;
    siginfo_t  info;
    int        rc;
    pthread_t  ppid = pthread_self();

    pthread_detach(ppid);

    sigemptyset(&waitset);
    sigaddset(&waitset, SIGRTMIN);
    sigaddset(&waitset, SIGUSR1);

    while (1)  {
        rc = sigwaitinfo(&waitset, &info);
        if (rc != -1) {
            printf("sigwaitinfo() fetch the signal - %d\n", rc);
            sig_handler(info.si_signo);
        } else {
            printf("sigwaitinfo() returned err: %d; %s\n", errno, strerror(errno));
        }
    }
}


int main()
{
    sigset_t bset, oset;
    int             i;
    pid_t           pid = getpid();
    pthread_t       ppid;


    // Block SIGRTMIN and SIGUSR1 which will be handled in 
    //dedicated thread sigmgr_thread()
    // Newly created threads will inherit the pthread mask from its creator 
    sigemptyset(&bset);
    sigaddset(&bset, SIGRTMIN);
    sigaddset(&bset, SIGUSR1);
    if (pthread_sigmask(SIG_BLOCK, &bset, &oset) != 0)
        printf("!! Set pthread mask failed\n");

    // Create the dedicated thread sigmgr_thread() which will handle 
    // SIGUSR1 and SIGRTMIN synchronously
    pthread_create(&ppid, NULL, sigmgr_thread, NULL);

    // Create 5 worker threads, which will inherit the thread mask of
    // the creator main thread
    for (i = 0; i < 5; i++) {
        pthread_create(&ppid, NULL, worker_thread, NULL);
    }

    // send out 50 SIGUSR1 and SIGRTMIN signals
    for (i = 0; i < 50; i++) {
        kill(pid, SIGUSR1);
        printf("main thread, send SIGUSR1 No. %d\n", i);
        kill(pid, SIGRTMIN);
        printf("main thread, send SIGRTMIN No. %d\n", i);
        sleep(10);
    }
    exit (0);
}
```

#### Best practice on Signal based Readiness Notification

I want to take a addition more section to talk about signal based readiness notification, because:
1. it is quit interesting. As the first feeling of the underhood excecuting mechanism,  It seems good. Let's see why it not spread out.. 
2. \([http:\/\/www.visolve.com\/uploads\/resources\/squidrtsignal.pdf\)A](http://www.visolve.com/uploads/resources/squidrtsignal.pdf)A\) new interface  called 
kqueue\[3\]  has  been  implemented  on  the  FreeBSD  opera
ting  system.  Kqueue  was 
designed to eliminate the performance problems of p
olling and avoid the difficulties 
found in RealTime signals. But, there is currently 
no implementation for Linux yet. Our 
main focus is on RealTime signals because it is rea
dily available for Linux.

\([http:\/\/davmac.org\/davpage\/linux\/async-io.html\#signals](http://davmac.org/davpage/linux/async-io.html#signals)\)
The IO signal technique, in conjunction with the signal wait functions, can be used to reliably wait on a set of events including both I\/O readiness events and other signals. As such, it is already close to a complete solution to the problem.

The reason why we can't select SIGIO signal as the realtime signal for I\/O readiness notification:
\([http:\/\/www.linuxprogrammingblog.com\/all-about-linux-signals?page=show](http://www.linuxprogrammingblog.com/all-about-linux-signals?page=show)\)
By default it's SIGIO, but using Real-time signals is more practical and you can set up the file descriptor using fcntl\(2\). 
\([http:\/\/davmac.org\/davpage\/linux\/async-io.html\#signals](http://davmac.org/davpage/linux/async-io.html#signals)\)
Note also that SIGIO can itself be selected as the notification signal. This allows the assosicated extra data to be retrieved, however, multiple SIGIO signals will not be queued and there is no way to detect if signals have been lost, so it is necessary to treat each SIGIO as an overflow regardless. It's much better to use a real-time signal. If you do, you potentially have an asynchronous event handling scheme which in some cases may be more efficient than using poll\(\) and perhaps even epoll\(\), which will soon be discussed.

To make a complete solution based on signal, we need to combin signal and poll technologies together.

[http:\/\/www.visolve.com\/uploads\/resources\/squidrtsignal.pdf](http://www.visolve.com/uploads/resources/squidrtsignal.pdf) 
tells us what need additional handling besides the happy path \(queue overflow, missing the beginging events before setup signal but socket has been created....\)

[http:\/\/www.lxway.com\/4444140926.htm](http://www.lxway.com/4444140926.htm)
tells the handling differences between linux 2.4 and linux2.6, as well as some coding details

[http:\/\/www.kegel.com\/c10k.html\#nb.sigio](http://www.kegel.com/c10k.html#nb.sigio)
tells us a highlevel summary of how to use signal to resolve the prolbem

[http:\/\/davmac.org\/davpage\/linux\/async-io.html\#signals](http://davmac.org/davpage/linux/async-io.html#signals)
tells the basic concept and signal API usage\(e.g: how many api can use to await for events\), why we select rtsignal instead of SIGIO

[https:\/\/www.nginx.com\/resources\/wiki\/start\/topics\/tutorials\/optimizations\/\#](https://www.nginx.com/resources/wiki/start/topics/tutorials/optimizations/#)
tell us some brief summary about nginx support rtsig from nginx implementation and what changes since 2.6

based on above materilas, make a sequencing diagram about the details of how to use signal as well as poll to come out a complete solution.

1. Before 2.6: \(SIGIO can be put to signal queue for socket event queue overflow notification\)

  > TODO:
  > e.g: system \("echo 49152 &gt; \/proc\/sys\/kernel\/rtsig-max"\)--&gt; create socket file descriptor --&gt; Mask off SIGIO and the signal you want to use \(which will result in the event to be queued\) --&gt;  invoke F\_SETOWN, F\_SETSIG, and set O\_ASYNC, O\_NONBLOCK. --&gt; use poll make sure no missing notification event ---&gt; after handling the data coming during we initial signal configuration via poll, get to normalized execution logic --&gt; use signalwait to detect I\/O event by rt-signal ---&gt; see if the queued event is SIGIO type, queue overflow occurs --&gt; flush events in queue --&gt; use poll to handle all of socket data --&gt; normalize execution and get back to rtsig await api

2. Since 2.6 \(SIGIO should be only be handled by a signal handler\)

  > TODO
  > struct rlimit rlim;
  > rlim.rlim\_cur=49152;
  > int setrlimit\(RLIMIT\_SIGPENDING, &rlim\); --&gt; create socket file descriptor --&gt; Mask off SIGIO and the signal you want to use \(which will result in the event to be queued\) --&gt;  invoke F\_SETOWN, F\_SETSIG, and set O\_ASYNC, O\_NONBLOCK. --&gt; use poll make sure no missing notification event ---&gt; after handling the data coming during we initial signal configuration via poll, get to normalized execution logic --&gt; use signalwait to detect I\/O event by rt-signal ---&gt; if receive SIGIO type event via signal hander, queue overflow occurs --&gt; flush events in queue --&gt; use poll to handle all of socket data --&gt; normalize execution and get back to rtsig await api


1. A solution to avoid signal queue overflow is to all
  ow only one event per socket file 
  descriptor in the signal queue.
  > \/_ 
  > Allow 
  > only 
  > one 
  > signal 
  > per 
  > socket 
  > fd 
  > _\/
  > fcntl\(sockfd, F\_SETAUXFL, O\_ONESIGFD\);


#### Epoll\(edge-trigerred\):

```
 https://bugzilla.kernel.org/show_bug.cgi?id=15272
 does not support regular file

 http://www.kegel.com/c10k.html
 On 11 July 2001, Davide Libenzi proposed an alternative to realtime signals; his patch provides what he now calls /dev/epoll www.xmailserver.org/linux-patches/nio-improve.html. This is just like the realtime signal readiness notification, but it coalesces redundant events, and has a more efficient scheme for bulk event retrieval.

 Epoll从multiplex角度看，他是ET, epoll的API内部也分为ET和LT两种。这是从两个不同层面的解读，不要混淆

 http://davmac.org/davpage/linux/async-io.html#signals
 Epoll is fairly efficient compared to the poll/select variants, but it still won't work with regular files.

 Epoll was introduced by a paper, explain a little bit about that paper(http://people.eecs.berkeley.edu/~sangjin/2012/12/21/epoll-vs-kqueue.html)
 http://blog.csdn.net/zys85/article/details/3710579
 http://it.taocms.org/12/6246.htm
 http://slidedeck.io/donatasm/hacking-an-nginx-module
 Give a timeline of select --> poll --> paper -->epoll(http://people.eecs.berkeley.edu/~sangjin/2012/12/21/epoll-vs-kqueue.html, file:///home/lizh/materials/studyplan/Nginx/Linux%20IO%20%E5%A4%9A%E8%B7%AF%E5%A4%8D%E7%94%A8%E6%98%AF%E4%BB%80%E4%B9%88%E6%84%8F%E6%80%9D%EF%BC%9F%20-%20Linux%20%E5%BC%80%E5%8F%91%20-%20%E7%9F%A5%E4%B9%8E.html)

 Give a chart about how epoll improve the perf so much
 (file:///home/lizh/materials/studyplan/Nginx/Linux%20IO%20%E5%A4%9A%E8%B7%AF%E5%A4%8D%E7%94%A8%E6%98%AF%E4%BB%80%E4%B9%88%E6%84%8F%E6%80%9D%EF%BC%9F%20-%20Linux%20%E5%BC%80%E5%8F%91%20-%20%E7%9F%A5%E4%B9%8E.html)

 Epoll is so important, explain a little bit more about the two work mode: LT和ET的区别(http://m.blog.csdn.net/article/details?id=39895449, http://www.ccvita.com/515.html)

 Select Vs poll Vs Epoll (http://amsekharkernel.blogspot.com/2013/05/what-is-epoll-epoll-vs-select-call-and.html)

 Time Complexity: (http://amsekharkernel.blogspot.com/2013/05/what-is-epoll-epoll-vs-select-call-and.html)
```

The synchornized-demultiplexing evolution timeline:
      select --&gt; poll --&gt; SIGIO --&gt; paper --&gt; epoll --&gt; ?\(aio combined epoll\)
      最后这项需要调研一下

\([http:\/\/www.programering.com\/a\/MDN2IzMwATQ.html](http://www.programering.com/a/MDN2IzMwATQ.html)\) it will only "active" socket - this is because on the kernel of epoll is based on the callback function on each FD implementation.

```c
#include <errno.h>
#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/epoll.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <netdb.h>

static int
create_and_bind (char *port)
{
  struct addrinfo hints;
  struct addrinfo *result, *rp;
  int s, sfd;

  memset (&hints, 0, sizeof (struct addrinfo));
  hints.ai_family = AF_UNSPEC;     /* Return IPv4 and IPv6 choices */
  hints.ai_socktype = SOCK_STREAM; /* We want a TCP socket */
  hints.ai_flags = AI_PASSIVE;     /* All interfaces */

  s = getaddrinfo (NULL, port, &hints, &result);
  if (s != 0)
    {
      fprintf (stderr, "getaddrinfo: %s\n", gai_strerror (s));
      return -1;
    }

  for (rp = result; rp != NULL; rp = rp->ai_next)
    {
      sfd = socket (rp->ai_family, rp->ai_socktype, rp->ai_protocol);
      if (sfd == -1)
        continue;

      s = bind (sfd, rp->ai_addr, rp->ai_addrlen);
      if (s == 0)
        {
          /* We managed to bind successfully! */
          break;
        }

      close (sfd);
    }

  if (rp == NULL)
    {
      fprintf (stderr, "Could not bind\n");
      return -1;
    }

  freeaddrinfo (result);

  return sfd;
}

static int
make_socket_non_blocking (int sfd)
{
  int flags, s;

  flags = fcntl (sfd, F_GETFL, 0);
  if (flags == -1)
    {
      perror ("fcntl");
      return -1;
    }

  flags |= O_NONBLOCK;
  s = fcntl (sfd, F_SETFL, flags);
  if (s == -1)
    {
      perror ("fcntl");
      return -1;
    }

  return 0;
}

#define MAXEVENTS 64

static const char reply[] =
"HTTP/1.0 200 OK\r\n"
"Content-type: text/html\r\n"
"Connection: close\r\n"
"Content-Length: 82\r\n"
"\r\n"
"<html>\n"
"<head>\n"
"<title>performance test</title>\n"
"</head>\n"
"<body>\n"
"test\n"
"</body>\n"
"</html>"
;

int
main (int argc, char *argv[])
{
  int sfd, s;
  int efd;
  struct epoll_event event;
  struct epoll_event *events;

  if (argc != 2)
    {
      fprintf (stderr, "Usage: %s [port]\n", argv[0]);
      exit (EXIT_FAILURE);
    }

  sfd = create_and_bind (argv[1]);
  if (sfd == -1)
    abort ();

  s = make_socket_non_blocking (sfd);
  if (s == -1)
    abort ();

  s = listen (sfd, SOMAXCONN);
  if (s == -1)
    {
      perror ("listen");
      abort ();
    }

  efd = epoll_create1 (0);
  if (efd == -1)
    {
      perror ("epoll_create");
      abort ();
    }

  event.data.fd = sfd;
  event.events = EPOLLIN | EPOLLET;
  s = epoll_ctl (efd, EPOLL_CTL_ADD, sfd, &event);
  if (s == -1)
    {
      perror ("epoll_ctl");
      abort ();
    }

  /* Buffer where events are returned */
  events = calloc (MAXEVENTS, sizeof event);

  /* The event loop */
  while (1)
    {
      int n, i;

      n = epoll_wait (efd, events, MAXEVENTS, -1);
      for (i = 0; i < n; i++)
    {
      if ((events[i].events & EPOLLERR) ||
              (events[i].events & EPOLLHUP) ||
              (!(events[i].events & EPOLLIN)))
        {
              /* An error has occured on this fd, or the socket is not
               * ready for reading (why were we notified then?) */
          fprintf (stderr, "epoll error. events=%u\n", events[i].events);
          close (events[i].data.fd);
          continue;
        }

      else if (sfd == events[i].data.fd)
        {
              /* We have a notification on the listening socket, which
               * means one or more incoming connections. */
              while (1)
                {
                  struct sockaddr in_addr;
                  socklen_t in_len;
                  int infd;
#if 0
                  char hbuf[NI_MAXHOST], sbuf[NI_MAXSERV];
#endif

                  in_len = sizeof in_addr;
                  infd = accept (sfd, &in_addr, &in_len);
                  if (infd == -1)
                    {
printf("errno=%d, EAGAIN=%d, EWOULDBLOCK=%d\n", errno, EAGAIN, EWOULDBLOCK);
                      if ((errno == EAGAIN) ||
                          (errno == EWOULDBLOCK))
                        {
                          /* We have processed all incoming
                           * connections. */
                          printf ("processed all incoming connections.\n");
                          break;
                        }
                      else
                        {
                          perror ("accept");
                          break;
                        }
                    }

#if 0
                  s = getnameinfo (&in_addr, in_len,
                                   hbuf, sizeof hbuf,
                                   sbuf, sizeof sbuf,
                                   NI_NUMERICHOST | NI_NUMERICSERV);
                  if (s == 0)
                    {
                      printf("Accepted connection on descriptor %d "
                             "(host=%s, port=%s)\n", infd, hbuf, sbuf);
                    }
#endif

                  /* Make the incoming socket non-blocking and add it to the
                   * list of fds to monitor. */
                  s = make_socket_non_blocking (infd);
                  if (s == -1)
                    abort ();

                  event.data.fd = infd;
                  event.events = EPOLLIN | EPOLLET;
printf("set events %u, infd=%d\n", event.events, infd);
                  s = epoll_ctl (efd, EPOLL_CTL_ADD, infd, &event);
                  if (s == -1)
                    {
                      perror ("epoll_ctl");
                      abort ();
                    }
                }
/*              continue; */
            }
          else
            {
              /* We have data on the fd waiting to be read. Read and
               * display it. We must read whatever data is available
               * completely, as we are running in edge-triggered mode
               * and won't get a notification again for the same
               * data. */
              int done = 0;

              while (1)
                {
                  ssize_t count;
                  char buf[512];

                  count = read (events[i].data.fd, buf, sizeof buf);
                  if (count == -1)
                    {
                      /* If errno == EAGAIN, that means we have read all
                       * data. So go back to the main loop. */
                      if (errno != EAGAIN)
                        {
                          perror ("read");
                          done = 1;
                        }
                      break;
                    }
                  else if (count == 0)
                    {
                      /* End of file. The remote has closed the
                       * connection. */
                      done = 1;
                      break;
                    }

                  /* Write the reply to connection */
                  s = write (events[i].data.fd, reply, sizeof(reply));
                  if (s == -1)
                    {
                      perror ("write");
                      abort ();
                    }
                }

              if (done)
                {
                  printf ("Closed connection on descriptor %d\n",
                          events[i].data.fd);

                  /* Closing the descriptor will make epoll remove it
                   * from the set of descriptors which are monitored. */
                  close (events[i].data.fd);
                }
            }
        }
    }

  free (events);

  close (sfd);

  return EXIT_SUCCESS;
}
```

[https:\/\/cnodejs.org\/topic\/4f16442ccae1f4aa270010a7](https://cnodejs.org/topic/4f16442ccae1f4aa270010a7)
在高性能的服务器编程中，IO 模型理所当然的是重中之重，需要谨慎选型的，对于网络套接字，我们可以采用epoll 的方式来轮询，尽管epoll也有一些缺陷，但总体来说还是很高效的，尤其来大量套接字的场景下；但对于Regular File 来说，是不能够用采用 poll\/epoll 的，即O\_NOBLOCK 方式对于传统文件句柄是无效的，也就是说我们的 open ,read, mkdir 之类的Regular File操作必定会导致阻塞.在多线程、多进程模型中，可以选择以同步阻塞的方式来进行IO操作，任务调度由操作系统来保证公平性，但在单进程\/线程模型中

### AIO

[http:\/\/www.pagefault.info\/?p=76](http://www.pagefault.info/?p=76)
[https:\/\/cnodejs.org\/topic\/4f16442ccae1f4aa270010a7](https://cnodejs.org/topic/4f16442ccae1f4aa270010a7)

#### Kernel AIO

[http:\/\/ftp.dei.uc.pt\/pub\/linux\/kernel\/people\/suparna\/aio-linux.pdf](http://ftp.dei.uc.pt/pub/linux/kernel/people/suparna/aio-linux.pdf)
Native Linux AIO API \(libaio\)
– io\_setup, io\_destroy \[queue setup\/teardown\]
– io\_submit \(e.g. IO\_CMD\_PREAD, IO\_CMD\_PWRITE\)
– io\_getevents \[completion status notification\]
– io\_cancel
[http:\/\/xinsuiyuer.github.io\/blog\/2014\/04\/17\/posix-aio-libaio-direct-io\/](http://xinsuiyuer.github.io/blog/2014/04/17/posix-aio-libaio-direct-io/)

#### Using eventfs to combine aio and epoll

pesuodo code

```
1. 創建一個eventfd
efd = eventfd(0, EFD_NONBLOCK | EFD_CLOEXEC);
2. 將eventfd設置到iocb中
io_set_eventfd(iocb, efd);
3. 交接AIO請求
io_submit(ctx, NUM_EVENTS, iocb);
4. 創建一個epollfd，並將eventfd加到epoll中
epfd = epoll_create(1);
epoll_ctl(epfd, EPOLL_CTL_ADD, efd, &epevent);
epoll_wait(epfd, &epevent, 1, -1);
5. 當eventfd可讀時，從eventfd讀出完成IO請求的數量，並調用io_getevents獲取這些IO
read(efd, &finished_aio, sizeof(finished_aio);
r = io_getevents(ctx, 1, NUM_EVENTS, events, &tms);
```

```c
#define _GNU_SOURCE
#define __STDC_FORMAT_MACROS

#include <stdio.h>
#include <errno.h>
#include <libaio.h>
#include <sys/eventfd.h>
#include <sys/epoll.h>
#include <stdlib.h>
#include <sys/types.h>
#include <unistd.h>
#include <stdint.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <inttypes.h>

#define TEST_FILE   "aio_test_file"
#define TEST_FILE_SIZE  (127 * 1024)
#define NUM_EVENTS  128
#define ALIGN_SIZE  512
#define RD_WR_SIZE  1024

struct custom_iocb
{
    struct iocb iocb;
    int nth_request;
};

void aio_callback(io_context_t ctx, struct iocb *iocb, long res, long res2)
{
    struct custom_iocb *iocbp = (struct custom_iocb *)iocb;
    printf("nth_request: %d, request_type: %s, offset: %lld, length: %lu, res: %ld, res2: %ld\n", 
            iocbp->nth_request, (iocb->aio_lio_opcode == IO_CMD_PREAD) ? "READ" : "WRITE",
            iocb->u.c.offset, iocb->u.c.nbytes, res, res2);
}

int main(int argc, char *argv[])
{
    int efd, fd, epfd;
    io_context_t ctx;
    struct timespec tms;
    struct io_event events[NUM_EVENTS];
    struct custom_iocb iocbs[NUM_EVENTS];
    struct iocb *iocbps[NUM_EVENTS];
    struct custom_iocb *iocbp;
    int i, j, r;
    void *buf;
    struct epoll_event epevent;

    efd = eventfd(0, EFD_NONBLOCK | EFD_CLOEXEC);
    if (efd == -1) {
        perror("eventfd");
        return 2;
    }

    fd = open(TEST_FILE, O_RDWR | O_CREAT | O_DIRECT, 0644);
    if (fd == -1) {
        perror("open");
        return 3;
    }
    ftruncate(fd, TEST_FILE_SIZE);

    ctx = 0;
    if (io_setup(8192, &ctx)) {
        perror("io_setup");
        return 4;
    }

    if (posix_memalign(&buf, ALIGN_SIZE, RD_WR_SIZE)) {
        perror("posix_memalign");
        return 5;
    }
    printf("buf: %p\n", buf);

    for (i = 0, iocbp = iocbs; i < NUM_EVENTS; ++i, ++iocbp) {
        iocbps[i] = &iocbp->iocb;
        io_prep_pread(&iocbp->iocb, fd, buf, RD_WR_SIZE, i * RD_WR_SIZE);
        io_set_eventfd(&iocbp->iocb, efd);
        io_set_callback(&iocbp->iocb, aio_callback);
        iocbp->nth_request = i + 1;
    }

    if (io_submit(ctx, NUM_EVENTS, iocbps) != NUM_EVENTS) {
        perror("io_submit");
        return 6;
    }

    epfd = epoll_create(1);
    if (epfd == -1) {
        perror("epoll_create");
        return 7;
    }

    epevent.events = EPOLLIN | EPOLLET;
    epevent.data.ptr = NULL;
    if (epoll_ctl(epfd, EPOLL_CTL_ADD, efd, &epevent)) {
        perror("epoll_ctl");
        return 8;
    }

    i = 0;
    while (i < NUM_EVENTS) {
        uint64_t finished_aio;

        if (epoll_wait(epfd, &epevent, 1, -1) != 1) {
            perror("epoll_wait");
            return 9;
        }

        if (read(efd, &finished_aio, sizeof(finished_aio)) != sizeof(finished_aio)) {
            perror("read");
            return 10;
        }

        printf("finished io number: %"PRIu64"\n", finished_aio);

        while (finished_aio > 0) {
            tms.tv_sec = 0;
            tms.tv_nsec = 0;
            r = io_getevents(ctx, 1, NUM_EVENTS, events, &tms);
            if (r > 0) {
                for (j = 0; j < r; ++j) {
                    ((io_callback_t)(events[j].data))(ctx, events[j].obj, events[j].res, events[j].res2);
                }
                i += r;
                finished_aio -= r;
            }
        }
    }

    close(epfd);
    free(buf);
    io_destroy(ctx);
    close(fd);
    close(efd);
    remove(TEST_FILE);

    return 0;
}
```

compile the source code:

```
gcc ./eventfs_aio_epoll.c -laio -o eventfs_aio_epoll
```

[http:\/\/fanli7.net\/a\/bianchengyuyan\/C\_\_\/20130728\/402136.html](http://fanli7.net/a/bianchengyuyan/C__/20130728/402136.html)

#### POSIX AIO

[http:\/\/ftp.dei.uc.pt\/pub\/linux\/kernel\/people\/suparna\/aio-linux.pdf](http://ftp.dei.uc.pt/pub/linux/kernel/people/suparna/aio-linux.pdf)
 POSIX AIO API \(glibc\)
– aio\_read\/aio\_write\/aio\_fsync
– lio\_listio
– aio\_cancel, aio\_suspend, aio\_return\/aio\_error

```
  http://blog.csdn.net/fz_ywj/article/details/9124897
  异步处理线程同步地处理每一个请求，处理完成后在对应的aiocb中填充结果，然后触发可能的信号通知或回调函数（回调函数是需要创建新线程来调用的）；
 In Linux, the real AIO actually is supported only on Disk IO, (
 http://lse.sourceforge.net/io/aio.html, (the real kernal aio, but not support socket)
 http://www.bullopensource.org/posix/ (not good at performance, it actually add a thread-mode in user-space, underearth, it still call the blocking system api)
 http://man7.org/linux/man-pages/man7/aio.7.html(The current Linux POSIX AIO implementation is provided in user space
   by glibc.  This has a number of limitations, most notably that
   maintaining multiple threads to perform I/O operations is expensive
   and scales poorly)
 http://stackoverflow.com/questions/8768083/difference-between-posix-aio-and-libaio-on-linux
 https://chamibuddhika.wordpress.com/2012/08/11/io-demystified/ 
 The situation for the AIO mode however is bit different at least in the Linux
```

case. The aio support for sockets in Linux seems to be shady at best with some
suggesting it is actually using readiness events at kernel level while providing
an asynchronous abstraction on completion events at application level. However
Windows seems to support this first class again via “I\/O Completion Ports”.\)Poxis AIO actually introduced thread model, not a real AIO supported from kernel level. For Network IO, we only have non-blocking IO. 
     How can we achieve I\/O multiplexing without thread-per-connection? You can simply do busy-wait polling for each connection with non-blocking socket operations, but this is too wasteful. What we need to know is which socket becomes ready. So the OS kernel provides a separate channel between your application and the kernel, and this channel notifies when some of your sockets become ready. This is how select\(\)\/poll\(\) works, based on the readiness model. \([http:\/\/people.eecs.berkeley.edu\/~sangjin\/2012\/12\/21\/epoll-vs-kqueue.html](http://people.eecs.berkeley.edu/~sangjin/2012/12/21/epoll-vs-kqueue.html)\)
     In Linux, for network, we only have multiplux way,  to implement non-blocking and sync IO, OS need provide two things:
     non-blocking socket, with this non-blocking socket, the caller thread can continue do some other things, in order to map the socket response to approparite socket client, a selector is needed here to do the mapping, once there is "readiness" event ready, and caller thread to pick that event up and do the corresponding actions on correct socket. This is IO multipluxer\([http:\/\/people.eecs.berkeley.edu\/~sangjin\/2012\/12\/21\/epoll-vs-kqueue.html](http://people.eecs.berkeley.edu/~sangjin/2012/12/21/epoll-vs-kqueue.html) what is multiplux\)

[http:\/\/davmac.org\/davpage\/linux\/async-io.html](http://davmac.org/davpage/linux/async-io.html) \(why poxis aio is not suited to use\)

[https:\/\/cnodejs.org\/topic\/4f16442ccae1f4aa270010a7](https://cnodejs.org/topic/4f16442ccae1f4aa270010a7)
provide the proof of multiple threads are involved to simulate a noblocking behavior

## Event Loop Programming Model\(The Bridge of From Reactor Pattern to Proactor pattern\)

Even we have reactor pattern, it is still hard for programmer to write a good performance server, because this require developer have a deep understand about the thread-safe on the language and lower level OS technology, if not, reactor pattern may have result a regresson server than thread-mode  
 Alought OS kernel did not provide us a easy to do this, smarter programmer never give up the effort to figure out a way  move to Proactor pattern on Reactor pattern, the answer is yes, we can 封装 a thread-mode to adopt the reactor pattern to proactor pattern, the answer is event-loop mode

Please keep in mind, the event-loop mode we mentioned in this article is specific to IO event-loop, not a general event loop, as event loop mode actually is also used widely in the GUI world, e.g: user click mouse on a button, and move a window from one area to an other...

event\_loop, the result will be callback to caller, it usually come together with a well thread-model implementation

what is event loop\([https:\/\/seanlin0800.gitbooks.io\/async-performance\/content\/source\/ch1\/event\_loop.html](https://seanlin0800.gitbooks.io/async-performance/content/source/ch1/event_loop.html), [http:\/\/blog.jobbole.com\/50138\/](http://blog.jobbole.com/50138/)\)

### Tick

explain what is tick in event loop programming model
[http:\/\/stackoverflow.com\/questions\/19822668\/what-exactly-is-a-node-js-event-loop-tick](http://stackoverflow.com/questions/19822668/what-exactly-is-a-node-js-event-loop-tick)

For event loop, in general, it compsoite with several typical phases, the tick actually means, the the future time, it reach to the current phase again. You might be feel confusing about this per your experiences in nodejs, setImmediate vs. nextTick, seems the nextTick will be executed immediately, but setImmediate actually be executed when next "check" phase coming. why? please refer to \(https:\/\/github.com\/nodejs\/node\/blob\/master\/doc\/topics\/the-event-loop-timers-and-nexttick.md\) for more details

## Event-loop based I\/O framework across different programming languages

### C programming language:

#### Nginx: event mode\(file:\/\/\/home\/lizh\/materials\/studyplan\/Nginx\/ReadyState4%20%C2%BB%20Blog%20Archive%20%C2%BB%20Nginx,%20the%20non-blocking%20model,%20and%20why%20Apache%20sucks.html\)

event module: [http:\/\/www.cnblogs.com\/fll369\/archive\/2012\/11\/29\/2794939.html](http://www.cnblogs.com/fll369/archive/2012/11/29/2794939.html)
 [http:\/\/nginx-book.readthedocs.io\/en\/latest\/chapter\_06.html\#event-40](http://nginx-book.readthedocs.io/en/latest/chapter_06.html#event-40)
 [https:\/\/www.nginx.com\/blog\/thread-pools-boost-performance-9x\/](https://www.nginx.com/blog/thread-pools-boost-performance-9x/) \(event loop and thread based event loop\)
  [http:\/\/slidedeck.io\/donatasm\/hacking-an-nginx-module](http://slidedeck.io/donatasm/hacking-an-nginx-module) \(master and worker has their individual event loop\)
  [http:\/\/www.aosabook.org\/en\/nginx.html](http://www.aosabook.org/en/nginx.html) \(nginx uses multiplexing and event notifications heavily,Aimed at solving the C10K problem of 10,000 simultaneous connections, nginx was written with a different architecture in mind—one which is much more suitable for nonlinear scalability in both the number of simultaneous connections and requests per second. nginx is event-based, so it does not follow Apache's style of spawning new processes or threads for each web page request. The end result is that even as load increases, memory and CPU usage remain manageable. nginx can now deliver tens of thousands of concurrent connections on a server with typical hardware.\)
  [https:\/\/dzone.com\/articles\/inside-nginx-how-we-designed](https://dzone.com/articles/inside-nginx-how-we-designed)
  [http:\/\/www.xxbar.net\/thread-854661-1-1.html\(nginx](http://www.xxbar.net/thread-854661-1-1.html(nginx) use linux kernel aio for file access if compile with a specific tag\)
  [http:\/\/www.infoq.com\/cn\/articles\/thread-pools-boost-performance-9x](http://www.infoq.com/cn/articles/thread-pools-boost-performance-9x)
  一些操作系统为读写文件提供了异步接口，NGINX可以使用这样的接口（见AIO指令）。FreeBSD就是个很好的例子。不幸的是，我们不能在Linux上得到相同的福利。虽然Linux为读取文件提供了一种异步接口，但是存在明显的缺点。其中之一是要求文件访问和缓冲要对齐，但NGINX很好地处理了这个问题。但是，另一个缺点更糟糕。异步接口要求文件描述符中要设置O\_DIRECT标记，就是说任何对文件的访问都将绕过内存中的缓存，这增加了磁盘的负载。在很多场景中，这都绝对不是最佳选择。

Nginx High Performance page-2 diagram
  NGINX has its foundation in event-based architecture \(EBA\). In EBA, components
interact predominantly using event notifications instead of direct method calls. These
event notifications, occurring from different tasks, are then queued for processing
by an event handler. The event handler runs in an event loop, where it processes an
event, de-queues it, and then moves on to the next event. Thus, the work executed by
a thread is very similar to that of a scheduler, multiplexing multiple connections to a
single flow of execution. The following diagram shows this:

Nginx Event Models

NGINX supports the following methods of treating the connections, which can be assigned by the use directive:

select - standard method. Compiled by default, if the current platform does not have a more effective method. You can enable or disable this module by using configuration parameters --with-select\_module and --without-select\_module.
poll - standard method. Compiled by default, if the current platform does not have a more effective method. You can enable or disable this module by using configuration parameters --with-poll\_module and --without-poll\_module.
kqueue - the effective method, used on FreeBSD 4.1+, OpenBSD 2.9+, NetBSD 2.0 and MacOS X. With dual-processor machines running MacOS X using kqueue can lead to kernel panic.
epoll - the effective method, used on Linux 2.6+. In some distrubutions, like SuSE 8.2, there are patches for supporting epoll by kernel version 2.4.
rtsig - real time signals, the executable used on Linux 2.2.19+. By default no more than 1024 POSIX realtime \(queued\) signals can be outstanding in the entire system. This is insufficient for highly loaded servers; it’s therefore necessary to increase the queue size by using the kernel parameter \/proc\/sys\/kernel\/rtsig-max. However, starting with Linux 2.6.6-mm2, this parameter is no longer available, and for each process there is a separate queue of signals, the size of which is assigned by RLIMIT\_SIGPENDING. When the queue becomes overcrowded, NGINX discards it and begins processing connections using the poll method until the situation normalizes.
\/dev\/poll - the effective method, used on Solaris 7 11\/99+, HP\/UX 11.22+ \(eventport\), IRIX 6.5.15+ and Tru64 UNIX 5.1A+.

[http:\/\/nginx.org\/en\/docs\/events.html](http://nginx.org/en/docs/events.html)

nginx supports a variety of connection processing methods. The availability of a particular method depends on the platform used. On platforms that support several methods nginx will normally select the most efficient method automatically. However, if needed, a connection processing method can be selected explicitly with the use directive.

The following connection processing methods are supported:

select — standard method. The supporting module is built automatically on platforms that lack more efficient methods. The --with-select\_module and --without-select\_module configuration parameters can be used to forcibly enable or disable the build of this module.

poll — standard method. The supporting module is built automatically on platforms that lack more efficient methods. The --with-poll\_module and --without-poll\_module configuration parameters can be used to forcibly enable or disable the build of this module.

kqueue — efficient method used on FreeBSD 4.1+, OpenBSD 2.9+, NetBSD 2.0, and Mac OS X.

epoll — efficient method used on Linux 2.6+.

Some older distributions like SuSE 8.2 provide patches that add epoll support to 2.4 kernels.
\/dev\/poll — efficient method used on Solaris 7 11\/99+, HP\/UX 11.22+ \(eventport\), IRIX 6.5.15+, and Tru64 UNIX 5.1A+.

eventport — event ports, efficient method used on Solaris 10.

[https:\/\/assets.wp.nginx.com\/wp-content\/uploads\/2016\/05\/nginx-modules-reference-r9.pdf](https://assets.wp.nginx.com/wp-content/uploads/2016/05/nginx-modules-reference-r9.pdf)
[http:\/\/www.pagefault.info\/?p=76](http://www.pagefault.info/?p=76)
[https:\/\/cnodejs.org\/topic\/4f16442ccae1f4aa270010a7](https://cnodejs.org/topic/4f16442ccae1f4aa270010a7)
Nginx support AIO for file access in the recent new releases

#### Libevent

[https:\/\/zhuanlan.zhihu.com\/p\/20315482](https://zhuanlan.zhihu.com/p/20315482)

[http:\/\/www.voidcn.com\/blog\/u012062760\/article\/p-4654532.html](http://www.voidcn.com/blog/u012062760/article/p-4654532.html)
libevent中的信号集中处理是什么呢？ 我们知道, 信号总是来的很突然, 以及因为信号的特殊, 信号处理函数的内容不宜过多, 所以在libevent中, 每个信号真正要做的事情就不被放在信号处理函数中完成. 那么如何完成信号要真正处理的事件呢？ 既然libevent是事件驱动框架, 那么就将每个信号的到来看作一个事件, 将信号与epoll利用管道相联系. 每个需要处理的信号在发生后, 其信号处理函数都只是简单的向管道发送数据\(数据往往是每个信号的整型值\), 这样, epoll在检查管道中的数据时就会得知某信号发生了, 之后就调用该信号对应的真正的处理函数进行处理. 所以, 管道一端描述符在epoll中注册的事件处理函数的主要工作就是, 读取管道中的内容, 根据不同的信号调用不同的处理函数.

#### Libev

#### Libuv\([https:\/\/nikhilm.github.io\/uvbook\/basics.html\#event-loops](https://nikhilm.github.io/uvbook/basics.html#event-loops)\)

### Java programming language:

Netty:

```
Event-Loop(Thread mode) + ChannelPipleline(Extensible event handling framework)

A diagram:

          Netty     ---> (eventloop + channelpipleline, async pattern)
          jvm(NIO)  ---> (selector)
          os(epoll) ---> (sync-demultipluxer(selector))
From 3.x to 4.x, Netty get back to singlethread strategy for the thread-mode, because a good framework should know who important it is to reduce the complexicity for the end user. If each channel(connection) still can switch among different threads, that somewhat take programmer back to the bare reactor pattern, that is a regression from end user experience perspective.

Explain about event-loop in netty , channelpipeline in netty with diagram
```

### Node.js:

Diagram about how nodejs works
 \([http:\/\/www.ruanyifeng.com\/blog\/2014\/10\/event-loop.html](http://www.ruanyifeng.com/blog/2014/10/event-loop.html)\)

[https:\/\/github.com\/nodejs\/node\/blob\/master\/doc\/topics\/the-event-loop-timers-and-nexttick.md](https://github.com/nodejs/node/blob/master/doc/topics/the-event-loop-timers-and-nexttick.md)

\(alternative begin: [https:\/\/vimeo.com\/96425312](https://vimeo.com/96425312) Us JavaScript programmers like to use words like, "event-loop", "non-blocking", "callback", "asynchronous", "single-threaded" and "concurrency".

We say things like "don't block the event loop", "make sure your code runs at 60 frames-per-second", "well of course, it won't work, that function is an asynchronous callback!"

If you're anything like me, you nod and agree, as if it's all obvious, even though you don't actually know what the words mean; and yet, finding good explanations of how JavaScript actually _works_ isn't all that easy, so let's learn!

With some handy visualisations, and fun hacks, let's get an intuitive understanding of what happens when JavaScript runs. Beginner or veteran, I'm sure you'll learn something!\)

## Weak point in event-loop

For the thread model, e.g: node.js, in the main loop, if cpu-intensive job performance, the server will lost response. To sovle this, the straightforward way is to make the cpu-intensive work running in a separate thread\/process\(different than the main event-loop process\). 
Nginx realize this problem, in 1.7, it introduce multple thread model in their even model
Netty's event-loop can add customized strategy ??

## Is event-loop model the ONLY choice?

Of course not, essentially, the event loop model is on the way of using less threads to service more requests\/connections. In an other hand, erlang and golang are resolving the problem by making a lightweight "green-thread" to archive the same goal. and also do this very well in their direction.
 [http:\/\/demo.netfoucs.com\/jiao\_fuyou\/article\/details\/36010691](http://demo.netfoucs.com/jiao_fuyou/article/details/36010691)

## Wrap up

IO Pattern:         Blocking and Sync ---&gt; non-blocking Sync --&gt; non-blocking async
    OS\(kernel\):                            non-blocking socket           AIO
                                              multipulex\(epoll\)
Programming Model:                             Java NIO      --\(event-loop\)----&gt;   Netty
                                                 C-------------event-module--------&gt; Nginx
                                                 JS             \(libuv\)         ---&gt; node.js

```
         IO Pattern           BLocking and Sync -->(kernel) -->   NIO      Async IO
```

evolution timeline:

## References

\[1\] [http:\/\/www.ibm.com\/developerworks\/linux\/library\/l-async\/](http://www.ibm.com/developerworks/linux/library/l-async/)

\[2\] TCP Socket In C Pratical Guide for programers

\[3\] Unix Network Programming

\[4\] Advanced Linux Programming

\[5\] TCPIP Sockets In C Pratical Guide For Programmers 2nd edition

\[6\] [http:\/\/davmac.org\/davpage\/linux\/async-io.html](http://davmac.org/davpage/linux/async-io.html)

\[7\] [http:\/\/gngrwzrd.com\/libgwrl\/pod.html\#reactor\_pattern](http://gngrwzrd.com/libgwrl/pod.html#reactor_pattern)

\[8\] [https:\/\/nikhilm.github.io\/uvbook\/basics.html\#event-loops](https://nikhilm.github.io/uvbook/basics.html#event-loops)

\[9\] [https:\/\/chamibuddhika.wordpress.com\/2012\/08\/11\/io-demystified\/](https://chamibuddhika.wordpress.com/2012/08/11/io-demystified/)

\[10\] [http:\/\/people.eecs.berkeley.edu\/~sangjin\/2012\/12\/21\/epoll-vs-kqueue.html](http://people.eecs.berkeley.edu/~sangjin/2012/12/21/epoll-vs-kqueue.html)

\[11\] [http:\/\/amsekharkernel.blogspot.com\/2013\/05\/what-is-epoll-epoll-vs-select-call-and.html](http://amsekharkernel.blogspot.com/2013/05/what-is-epoll-epoll-vs-select-call-and.html)

\[12\] [https:\/\/seanlin0800.gitbooks.io\/async-performance\/content\/source\/ch1\/event\_loop.html](https://seanlin0800.gitbooks.io/async-performance/content/source/ch1/event_loop.html)

\[13\] [https:\/\/nikhilm.github.io\/uvbook\/basics.html\#event-loops](https://nikhilm.github.io/uvbook/basics.html#event-loops)

\[14\] [http:\/\/man7.org\/linux\/man-pages\/man7\/aio.7.html](http://man7.org/linux/man-pages/man7/aio.7.html)

\[15\] [https:\/\/www.fsl.cs.sunysb.edu\/~vass\/linux-aio.txt](https://www.fsl.cs.sunysb.edu/~vass/linux-aio.txt)

\[16\] file:\/\/\/home\/lizh\/materials\/studyplan\/Netty\/Netty%E7%B3%BB%E5%88%97%E4%B9%8BNetty%E7%BA%BF%E7%A8%8B%E6%A8%A1%E5%9E%8B.html

\[17\] [http:\/\/www.wangafu.net\/~nickm\/libevent-book\/01\_intro.html](http://www.wangafu.net/~nickm/libevent-book/01_intro.html)

\[18\] [http:\/\/xinsuiyuer.github.io\/blog\/2014\/04\/17\/posix-aio-libaio-direct-io\/](http://xinsuiyuer.github.io/blog/2014/04/17/posix-aio-libaio-direct-io/)

\[19\] [https:\/\/github.com\/angrave\/SystemProgramming\/wiki\/Signals,-Part-2:-Pending-Signals-and-Signal-Masks](https://github.com/angrave/SystemProgramming/wiki/Signals,-Part-2:-Pending-Signals-and-Signal-Masks)

\[20\] [http:\/\/www.makelinux.net\/ldd3\/chp-6-sect-4](http://www.makelinux.net/ldd3/chp-6-sect-4)

\[21\] [https:\/\/en.wikipedia.org\/wiki\/Asynchronous\_I\/O\#Signals\_.28interrupts.29](https://en.wikipedia.org/wiki/Asynchronous_I/O#Signals_.28interrupts.29)

\[22\] [http:\/\/lse.sourceforge.net\/io\/aio.html](http://lse.sourceforge.net/io/aio.html)

\[23\] [http:\/\/www.bullopensource.org\/posix\/](http://www.bullopensource.org/posix/)

\[24\] [http:\/\/www.ruanyifeng.com\/blog\/2014\/10\/event-loop.html](http://www.ruanyifeng.com/blog/2014/10/event-loop.html)

\[25\] [http:\/\/www.ccvita.com\/515.html](http://www.ccvita.com/515.html)

\[26\] file:\/\/\/home\/lizh\/materials\/studyplan\/Nginx\/Linux%20IO%20%E5%A4%9A%E8%B7%AF%E5%A4%8D%E7%94%A8%E6%98%AF%E4%BB%80%E4%B9%88%E6%84%8F%E6%80%9D%EF%BC%9F%20-%20Linux%20%E5%BC%80%E5%8F%91%20-%20%E7%9F%A5%E4%B9%8E.html

\[27\] file:\/\/\/home\/lizh\/materials\/studyplan\/Nginx\/%E6%9E%B6%E6%9E%84%E5%B8%88%E5%AE%9E%E8%B7%B5%E6%97%A5%EF%BD%9C%E4%BB%8EC10K%E5%88%B0C10M%E9%AB%98%E6%80%A7%E8%83%BD%E7%BD%91%E7%BB%9C%E7%9A%84%E6%8E%A2%E7%B4%A2%E4%B8%8E%E5%AE%9E%E8%B7%B5%C2%A0%20\_%20%E4%B8%83%E7%89%9B%E4%BA%91%E5%AD%98%E5%82%A8.html

\[28\] [http:\/\/www.linuxprogrammingblog.com\/all-about-linux-signals?page=show](http://www.linuxprogrammingblog.com/all-about-linux-signals?page=show)

\[29\] [http:\/\/www.visolve.com\/uploads\/resources\/squidrtsignal.pdf](http://www.visolve.com/uploads/resources/squidrtsignal.pdf)

\[30\] [http:\/\/cs-pub.bu.edu\/fac\/richwest\/cs591\_w1\/notes\/wk3\_pt2.PDF](http://cs-pub.bu.edu/fac/richwest/cs591_w1/notes/wk3_pt2.PDF)

\[31\] [http:\/\/w0z1y.blog.163.com\/blog\/static\/116392700201201814549536\/](http://w0z1y.blog.163.com/blog/static/116392700201201814549536/)

\[32\] [http:\/\/linux.die.net\/man\/7\/signal](http://linux.die.net/man/7/signal)

\[33\] [http:\/\/www.linuxjournal.com\/article\/6483?page=0,1](http://www.linuxjournal.com/article/6483?page=0,1)

\[34\] [http:\/\/www.lxway.com\/4444140926.htm](http://www.lxway.com/4444140926.htm) \(real-time signal based selector\)

\[35\] [http:\/\/blog.csdn.net\/ykdsea\/article\/details\/46969677](http://blog.csdn.net/ykdsea/article/details/46969677)

\[36\] [http:\/\/blog.chinaunix.net\/uid-24774106-id-4061386.html](http://blog.chinaunix.net/uid-24774106-id-4061386.html)

\[37\] [http:\/\/blog.chinaunix.net\/uid-24774106-id-4064447.html](http://blog.chinaunix.net/uid-24774106-id-4064447.html)

\[38\] [http:\/\/www.kegel.com\/c10k.html](http://www.kegel.com/c10k.html)

\[39\] [http:\/\/bulk.fefe.de\/scalable-networking.pdf](http://bulk.fefe.de/scalable-networking.pdf)

\[40\] [http:\/\/www.freebsd.org\/cgi\/man.cgi?query=socket&apropos=0&sektion=7&manpath=SuSE+Linux%2Fi386+11.0&format=ascii](http://www.freebsd.org/cgi/man.cgi?query=socket&apropos=0&sektion=7&manpath=SuSE+Linux%2Fi386+11.0&format=ascii)

\[41\] [http:\/\/www.cnblogs.com\/liyux\/p\/5603826.html](http://www.cnblogs.com/liyux/p/5603826.html)

\[42\] [http:\/\/www.masterraghu.com\/subjects\/np\/introduction\/unix\_network\_programming\_v1.3\/ch05lev1sec8.html](http://www.masterraghu.com/subjects/np/introduction/unix_network_programming_v1.3/ch05lev1sec8.html)

\[43\] [http:\/\/compgeom.com\/~piyush\/teach\/4531\_06\/project\/hell.html](http://compgeom.com/~piyush/teach/4531_06/project/hell.html)

\[44\] Nginx High Performance

\[45\] [https:\/\/www.nginx.com\/resources\/wiki\/start\/topics\/tutorials\/optimizations\/\#](https://www.nginx.com/resources/wiki/start/topics/tutorials/optimizations/#)

\[46\] [http:\/\/www.programering.com\/a\/MDN2IzMwATQ.html](http://www.programering.com/a/MDN2IzMwATQ.html)

\[47\] [https:\/\/www.ibm.com\/developerworks\/cn\/linux\/l-cn-signalsec\/](https://www.ibm.com/developerworks/cn/linux/l-cn-signalsec/)

\[48\] [http:\/\/www.csl.mtu.edu\/cs4411.ck\/www\/NOTES\/process\/fork\/create.html](http://www.csl.mtu.edu/cs4411.ck/www/NOTES/process/fork/create.html)

\[49\] [http:\/\/www.lai18.com\/content\/1370755.html](http://www.lai18.com/content/1370755.html)

\[50\] [https:\/\/cnodejs.org\/topic\/4f16442ccae1f4aa270010a7](https://cnodejs.org/topic/4f16442ccae1f4aa270010a7)

\[51\] [https:\/\/assets.wp.nginx.com\/wp-content\/uploads\/2016\/05\/nginx-modules-reference-r9.pdf](https://assets.wp.nginx.com/wp-content/uploads/2016/05/nginx-modules-reference-r9.pdf)

\[52\] [http:\/\/www.ibm.com\/developerworks\/linux\/library\/l-reent\/index.html](http://www.ibm.com/developerworks/linux/library/l-reent/index.html)

\[53\] [http:\/\/www.pagefault.info\/?p=76](http://www.pagefault.info/?p=76)

\[54\] [http:\/\/ftp.dei.uc.pt\/pub\/linux\/kernel\/people\/suparna\/aio-linux.pdf](http://ftp.dei.uc.pt/pub/linux/kernel/people/suparna/aio-linux.pdf)

\[55\] [http:\/\/www.csdn123.com\/html\/blogs\/20131104\/92968.htm](http://www.csdn123.com/html/blogs/20131104/92968.htm)

\[56\] [http:\/\/fanli7.net\/a\/bianchengyuyan\/C\_\_\/20130728\/402136.html](http://fanli7.net/a/bianchengyuyan/C__/20130728/402136.html)

\[57\] [http:\/\/www.voidcn.com\/blog\/u012062760\/article\/p-4654532.html](http://www.voidcn.com/blog/u012062760/article/p-4654532.html)

\[58\] [http:\/\/blog.omega-prime.co.uk\/?p=155](http://blog.omega-prime.co.uk/?p=155)

\[59\] [https:\/\/blogs.msdn.microsoft.com\/csliu\/2009\/08\/27\/io-concept-blockingnon-blocking-vs-syncasync\/](https://blogs.msdn.microsoft.com/csliu/2009/08/27/io-concept-blockingnon-blocking-vs-syncasync/)

\[60\] [https:\/\/bugzilla.kernel.org\/show\_bug.cgi?id=15272](https://bugzilla.kernel.org/show_bug.cgi?id=15272)

\[61\] [http:\/\/tinyclouds.org\/iocp-links.html](http://tinyclouds.org/iocp-links.html) about async io in windows OS

\[62\] [http:\/\/www.remlab.net\/op\/nonblock.shtml](http://www.remlab.net/op/nonblock.shtml)

\[63\] [http:\/\/blog.csdn.net\/zxjcarrot\/article\/details\/32935001](http://blog.csdn.net/zxjcarrot/article/details/32935001)

\[64\] [http:\/\/www.programmr.com\/blogs\/difference-between-asynchronous-and-non-blocking](http://www.programmr.com/blogs/difference-between-asynchronous-and-non-blocking)

\[65\] [http:\/\/www.ulduzsoft.com\/2014\/01\/select-poll-epoll-practical-difference-for-system-architects\/](http://www.ulduzsoft.com/2014/01/select-poll-epoll-practical-difference-for-system-architects/)  examples for select poll epoll andlibevent

\[66\] [https:\/\/banu.com\/blog\/2\/how-to-use-epoll-a-complete-example-in-c\/](https://banu.com/blog/2/how-to-use-epoll-a-complete-example-in-c/) step-by-step for a socket server in c

\[67\] [http:\/\/www.ulduzsoft.com\/2014\/01\/select-poll-epoll-practical-difference-for-system-architects\/](http://www.ulduzsoft.com/2014/01/select-poll-epoll-practical-difference-for-system-architects/) including a simplified typical workflow for each multiplexing method

\[68\] [http:\/\/austingwalters.com\/io-multiplexing\/](http://austingwalters.com/io-multiplexing/) kqueue and epoll compare

\[69\] [http:\/\/neethack.com\/2013\/01\/understand-event-loops\/](http://neethack.com/2013/01/understand-event-loops/) node.js and eventloop

\[70\] [http:\/\/fred-zone.blogspot.com\/2012\/09\/glib-main-event-loop-nodejs-libuv.html](http://fred-zone.blogspot.com/2012/09/glib-main-event-loop-nodejs-libuv.html) event engine

\[71\] [https:\/\/coelhorjc.wordpress.com\/2014\/12\/18\/using-non-blocking-and-asynchronous-io-ck10-problem-in-linux-and-windows-with-epool-iocp-aiolibaio-libeventlibevlibuv-boost-asio\/](https://coelhorjc.wordpress.com/2014/12/18/using-non-blocking-and-asynchronous-io-ck10-problem-in-linux-and-windows-with-epool-iocp-aiolibaio-libeventlibevlibuv-boost-asio/)
various event loop framework and aio impl

\[72\] [http:\/\/www.tutorialspoint.com\/unix\_system\_calls\/\_newselect.htm](http://www.tutorialspoint.com/unix_system_calls/_newselect.htm) a simplest sample for select

\[73\] [https:\/\/segmentfault.com\/a\/1190000003063859](https://segmentfault.com/a/1190000003063859) 类似的文章，但写得不够全面

\[74\] [http:\/\/blog.csdn.net\/sbjiesbjie\/article\/details\/50717368](http://blog.csdn.net/sbjiesbjie/article/details/50717368) linux native aio examples

\[75\] [https:\/\/github.com\/nodejs\/node\/blob\/master\/doc\/topics\/the-event-loop-timers-and-nexttick.md explain with details about the phases in eventloop of nodejs\(unerd the hood, it is libuv\), also elaborate the differences for the asyn api, including nextTick, setTimeout and setImmeidate](https://github.com/nodejs/node/blob/master/doc/topics/the-event-loop-timers-and-nexttick.md)

\[76\] http:\/\/coolshell.cn\/articles\/7490.html 一篇综合介绍性能调优的文章

\[77\] http:\/\/www.slideshare.net\/brendangregg\/blazing-performance-with-flame-graphs  \(page-27\)

\[78\] http:\/\/xiaorui.cc\/2015\/12\/02\/%E4%BD%BF%E7%94%A8socket-so\_reuseport%E6%8F%90%E9%AB%98%E6%9C%8D%E5%8A%A1%E7%AB%AF%E6%80%A7%E8%83%BD\/ 

   reuseport to make the enable multiple thread to do the accept on same ip and port

