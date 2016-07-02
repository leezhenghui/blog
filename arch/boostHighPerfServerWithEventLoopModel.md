# Boost high scalability network server using event-loop model

Today in internet world, a common technonical challenge we are facing in network server scalability is how to ensure that the server handles a large number of connections simultaneously with a high performance. Explorer the excellent network server designs and implementations, the event-loop programming model seems usually take a key role in this field. Why? What underlying story is? I would like to jot down this writing which came cross with my earlier research/investigations as a future reference for me and any one who come across to this post. 

---

Brief Content Table:

>  1 I/O models under unix-like OS
> 
>> 1.1 Blocking I/O
>> 
>> 1.2 Non-blocking I/O
>> 
>> 1.3 I/O multiplexing
>> 
>> 1.4 Signal driven I/O
>> 
>> 1.5 Asynchronous I/O
>> 
>> 1.6 Blocking vs. Non-blocking
>> 
>> 1.7 Sync vs. Async
>
>2 Recap C10K problem
> 
>> 2.1 Issue
>>> 2.1.1 Thread-Based model
>>
>> 2.2 Soluction
>> 
>>> 2.2.1 Reactor model
>>> 
>>>> 2.2.1.1 Nonblocking in conjunction with level-triggered readiness notification
>>>> 
>>>> 2.2.1.2 Nonblocking in conjunction with edge-triggered readiness notification
>>> 
>>> 2.2.2 Proactor model
>
> 3 Linux kernel support
>>> 3.1 Nonblocking I/O
>>> 
>>> 3.2 Edge-triggered Demultipluxer
>>>> 
>>>> 3.2.1 Unix standard signal -- SIGIO
>>>> 
>>>> 3.2.2 POSIX Realtime signal
>>>>
>>>> 3.2.3 Epoll
>>> 
>>> 3.3 AIO
>>> 
>>>> 3.3.1 Linux Kernal AIO
>>>> 
>>>> 3.3.2 POXIS AIO
>>> 
>>>3.4 Edge-triggered Demultipluxer
>>>> 3.4.1 POXIS select
>>>> 
>>>> 3.4.2 Poll
>
>4 Event-loop programming model
>
>> 4.1 Tick
>> 
>> 4.2 Known event-loop based framework in different languages
>> 
>>> 4.2.1 C programming
>>> 
>>>> 4.2.1.1 Nginx
>>>> 
>>>> 4.2.1.2 libuv
>>>> 
>>>> 4.2.1.3 libevent
>>> 
>>> 4.2.2 Java programming
>>> 
>>>> 4.2.2.1 Java NIO(reimplemented based on epoll)
>>>> 
>>>> 4.2.2.2 Java NIO2 AsyncChannel
>>>> 
>>>> 4.2.2.3 Netty
>>> 
>>> 4.2.3 Node.js
>
>5 Weak point in event-loop model
>
>6 Alternative approach for C10K
>
>7 Wrappup

---

~~~
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
~~~

Before jumping into event-loop programming model, let's step back and take a look at the bigger picture, exploring the differences among the classic I/O models under unix-like operating system as well as the appropriate programming models which fit in these I/O models individually.

## I/O models under unix-like OS

~~~
  TODO, there are 5 I/O models comes from unix network programming
~~~

### Blocking I/O
The default behavior of a socket call in C standard library is to block until the requested action is completed. For example, the recv() function in TCPEchoClient.c (page 44) does not return until at least one message from the echo server is received. Of course, a process with a blocked function is suspended by the operating system. It is synchronous blocking I/O model, one of the most common models for socket I/O programming. In this model, the user-space application performs a system call that results in the application blocking. This means that the application blocks entirely until the system call is complete (e.g: process calls recvfrom, data is transferred from kernel buffer to user space buffer or error reported)

~~~
TODO, diagram
~~~

We use UDP for example, the process calls recvfrom and the system call does not return until the datagram arrives and is transferred from kernel buffer into our user space buffer, or an error occurs. We say that our process is blocked the entire time from when it calls recvfrom until it returns. When recvfrom returns successfully, our application continue processing the datagram. Imaging that we need to write a program to handle multiple connections at once, we almost no choice but fall into thread-per-connection programming model. We will talk about this programming model later with more details.

### Non-blocking I/O
When we set a socket to be nonblocking, we are telling the kernel "when an I/O operation
that I request cannot be completed without putting the process to sleep, do not put the
process to sleep, but return an error instead.
~~~
TODO, diagram
~~~

(TCP Socket In C Pratical Guide for programers)
The difficulty with nonblocking socket calls is that there is no way of knowing when one would
succeed, except by periodically trying it until it does (a process known as “polling”)

In this model, a device is opened as non-blocking. This means that instead of completing an I/O immediately, a read may return an error code indicating that the command could not be immediately satisfied (EAGAIN or EWOULDBLOCK), as shown in Figure 3.The implication of non-blocking is that an I/O command may not be satisfied immediately, requiring that the application make numerous calls to await completion. This can be extremely inefficient because in many cases the application must busy-wait until the data is available or attempt to do other work while the command is performed in the kernel. As also shown in Figure 3, this method can introduce latency in the I/O because any gap between the data becoming available in the kernel and the user calling read to return it can reduce the overall data throughput.

### I/O multiplexing

What is Multiplex? 

I/O Multiplexing

~~~
TODO, diagram
~~~

(wikipedia https://en.wikipedia.org/wiki/Asynchronous_I/O#Signals_.28interrupts.29)
Select(/poll) loops[edit]
Available in BSD Unix, and almost anything else with a TCP/IP protocol stack that either utilizes or is modeled after the BSD implementation. A variation on the theme of polling, a select loop uses the select system call to sleep until a condition occurs on a file descriptor (e.g., when data is available for reading), a timeout occurs, or a signal is received (e.g., when a child process dies). By examining the return parameters of the select call, the loop finds out which file descriptor has changed and executes the appropriate code. Often, for ease of use, the select loop is implemented as an event loop, perhaps using callback functions; the situation lends itself particularly well to event-driven programming.
While this method is reliable and relatively efficient, it depends heavily on the Unix paradigm that "everything is a file"; any blocking I/O that does not involve a file descriptor will block the process. The select loop also relies on being able to involve all I/O in the central select call; libraries that conduct their own I/O are particularly problematic in this respect. An additional potential problem is that the select and the I/O operations are still sufficiently decoupled that select's result may effectively be a lie: if two processes are reading from a single file descriptor (arguably bad design) the select may indicate the availability of read data that has disappeared by the time that the read is issued, thus resulting in blocking; if two processes are writing to a single file descriptor (not that uncommon) the select may indicate immediate writability yet the write may still block, because a buffer has been filled by the other process in the interim, or due to the write being too large for the available buffer or in other ways unsuitable to the recipient.
The select loop does not reach the ultimate system efficiency possible with, say, the completion queues method, because the semantics of the select call, allowing as it does for per-call tuning of the acceptable event set, consumes some amount of time per invocation traversing the selection array. This creates little overhead for user applications that might have open one file descriptor for the windowing system and a few for open files, but becomes more of a problem as the number of potential event sources grows, and can hinder development of many-client server applications, as in the C10k problem; other asynchronous methods may be noticeably more efficient in such cases. Some Unixes provide system-specific calls with better scaling; for example, epoll in Linux (that fills the return selection array with only those event sources on which an event has occurred), kqueue in FreeBSD, and event ports (and /dev/poll) in Solaris.
SVR3 Unix provided the poll system call. Arguably better-named than select, for the purposes of this discussion it is essentially the same thing. SVR4 Unixes (and thus POSIX) offer both calls.

> Multiplex model actually provide a efficent solution to select the readiness file descriptors, compare to pure nonblocking model, and then avoid waste processor cycles on the polling of each file descriptor status

### Signal driven I/O

~~~
TODO, diagram
~~~

(wikipedia https://en.wikipedia.org/wiki/Asynchronous_I/O#Signals_.28interrupts.29)
Available in BSD and POSIX Unix. I/O is issued asynchronously, and when it is completed a signal (interrupt) is generated. As in low-level kernel programming, the facilities available for safe use within the signal handler are limited, and the main flow of the process could have been interrupted at nearly any point, resulting in inconsistent data structures as seen by the signal handler. The signal handler is usually not able to issue further asynchronous I/O by itself.

http://www.linuxprogrammingblog.com/all-about-linux-signals?page=show
It's possible to be notified of I/O availability by a signal. It's an alternative to functions like select(2). It's done by setting the O_ASYNC flag on the file descriptor. If you do so and if I/O is available (as select(2) would consider it) a signal is sent to the process. By default it's SIGIO, but using Real-time signals is more practical and you can set up the file descriptor using fcntl(2) so that you get more information in siginfo_t structure. See the links at the bottom of this article for more information. There is now a better way to do it on Linux: epoll(7) and similar mechanisms are available on other systems. 

### signal



> In above sample, I use a sleep in the signal handler to make the sample easy to simulate the situation of a signal is executing. However, in a real-life application, this is not a suggested way, as we need to make the singal handler perform as minimal as possible.
> can Real-time signals workaround this???(http://www.linuxprogrammingblog.com/all-about-linux-signals?page=show)
> 
> The reason is that signals are asynchronous, the main program may be in a very fragile state
when a signal is processed and thus while a signal handler function executes.
Therefore, you should avoid performing any I/O operations or calling most library
and system functions from signal handlers.
A signal handler should perform the minimum work necessary to respond to the
signal, and then return control to the main program (or terminate the program). In
most cases, this consists simply of recording the fact that a signal occurred.The main
program then checks periodically whether a signal has occurred and reacts accordingly.
It is possible for a signal handler to be interrupted by the delivery of another signal.
While this may sound like a rare occurrence, if it does occur, it will be very difficult to
diagnose and debug the problem. (This is an example of a race condition, discussed in
Chapter 4, “Threads,” Section 4.4, “Synchronization and Critical Sections.”) Therefore,
you should be very careful about what your program does in a signal handler.

Above is proof of "If the same signal is delivered more than once while it is being
handled, the handler is only executed once more after it completes the original execution."

So, if we have concurrency connections, after we register the signal handler, we only can receive the previous notification, some subseqencing notifications will be ignored!

reference: http://www.makelinux.net/ldd3/chp-6-sect-4

6.4. Asynchronous Notification

Although the combination of blocking and nonblocking operations and the select method are sufficient for querying the device most of the time, some situations aren't efficiently managed by the techniques we've seen so far.

Let's imagine a process that executes a long computational loop at low priority but needs to process incoming data as soon as possible. If this process is responding to new observations available from some sort of data acquisition peripheral, it would like to know immediately when new data is available. This application could be written to call poll regularly to check for data, but, for many situations, there is a better way. By enabling asynchronous notification, this application can receive a signal whenever data becomes available and need not concern itself with polling.

User programs have to execute two steps to enable asynchronous notification from an input file. First, they specify a process as the "owner" of the file. When a process invokes the F_SETOWN command using the fcntl system call, the process ID of the owner process is saved in filp->f_owner for later use. This step is necessary for the kernel to know just whom to notify. In order to actually enable asynchronous notification, the user programs must set the FASYNC flag in the device by means of the F_SETFL fcntl command.

After these two calls have been executed, the input file can request delivery of a SIGIO signal whenever new data arrives. The signal is sent to the process (or process group, if the value is negative) stored in filp->f_owner.

For example, the following lines of code in a user program enable asynchronous notification to the current process for the stdin input file:

signal(SIGIO, &input_handler); /* dummy sample; sigaction(  ) is better */
fcntl(STDIN_FILENO, F_SETOWN, getpid(  ));
oflags = fcntl(STDIN_FILENO, F_GETFL);
fcntl(STDIN_FILENO, F_SETFL, oflags | FASYNC);


### Asynchronous I/O

~~~
TODO, diagram
~~~

### Blocking vs. Non-blocking

### Async vs. Sync
Both terms we used in this docutment are following POXIS standard definition. 

Async: xxxxx
Sync: xxxx

In the book of Unix network programming, it is talking about the I/O from operating system perspecitve. so we see the sample/explanation usually from a system call, and the anaylysis put more attention on the check of how the response datagram get back from kernel space to user space. From kernel support perspecitve, it depends that fact of whether the data is carried by from kernel space to user space under background.
We can also extend those idea/concept to a higher software layer,and check the I/O facility we used in that layer by the similar way, i.e how the facility consumer get the response or reported by the error.
e.g: in Java world, java NIO is sync with multipluxing, java NIO2 asyncchannel api actually perform async style interactions.
The aio support for sockets in Linux seems to be shady at best with some
suggesting it is actually using readiness events at kernel level while providing
an asynchronous abstraction on completion events at application level. However
Windows seems to support this first class again via “I/O Completion Ports”.

~~~
We have explorered  5 typical I/O models under unix-like OS with examples 
from operating system level, which explain the asynchronous and synchronous 
behaviors from the perspective of user space and kernel space. Actually, 
the two terms can also be adopted to higher level programming languages. 
Just keep in mind, for asynchronous I/O model, after we make the call on 
the I/O facility, the process will not in pending status, once the response 
arrive, the data gram will be transferred by underlying system component 
on background and a completion event which carrying response/error should be notified to process.
~~~

http://davmac.org/davpage/linux/async-io.html

The distinction between the two is largely a matter of operating mode (it is the difference between performing a read operation, for example, and being notified when the data is in the application's buffer, compared to simply being notified when the data is available and asking that it be copied to the application's buffer afterwards)

>  Note: Tim Jonh's has written a very good article to explain the usage of POSIX AIO API(see refe
>  rence [[1]](http://www.ibm.com/developerworks/linux/library/l-async/)), I like that article very much in general, but if the terminology of "asynchronous" can align with POSIX definition, that would be perfect.

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
## Recap C10K problem

Finally, we get to the problem -- C10K. 15 Years ago, xxx arise C10K problem which was a big chellenge( This situation is often called the c10k problem. With select() or poll(), your network server will hardly perform any useful things but wasting precious CPU cycles under such high load. 

C10K was raised based on condition/situation(both hardware and whole interenet ecosystem) at that time..Today, C10K problem itself is not a problem anymore, people even trying to resolve the challenge of C10M, but the insights/solution for C10K as the foundation of so many perfect softwares still enlighten us and point us to a way forward. 

http://amsekharkernel.blogspot.com/2013/05/what-is-epoll-epoll-vs-select-call-and.html
 file:///home/lizh/materials/studyplan/Nginx/%E6%9E%B6%E6%9E%84%E5%B8%88%E5%AE%9E%E8%B7%B5%E6%97%A5%EF%BD%9C%E4%BB%8EC10K%E5%88%B0C10M%E9%AB%98%E6%80%A7%E8%83%BD%E7%BD%91%E7%BB%9C%E7%9A%84%E6%8E%A2%E7%B4%A2%E4%B8%8E%E5%AE%9E%E8%B7%B5%C2%A0%20_%20%E4%B8%83%E7%89%9B%E4%BA%91%E5%AD%98%E5%82%A8.html)... the solution:
     Reactor Pattern and Proactor Pattern
     Explain reactor apttern and proactor pattern:
     
     reactor pattern diagram (http://gngrwzrd.com/libgwrl/pod.html#reactor_pattern)
     
     proactor pattern diagram(https://chamibuddhika.wordpress.com/2012/08/11/io-demystified/)
     
     Those two pattern actually mapped to the two I/O pattern:
     
    non-blocking sync IO: two things are quit important for this pattern:
        non-blocking and multiplexing
        
        explain what is multiplexing(http://people.eecs.berkeley.edu/~sangjin/2012/12/21/epoll-vs-kqueue.html)
    
    non-blocking async IO
    
    Let's explorer the situations from kernel and programming language..

 ## Programming Models(is is good to mentioned here, maybe better to introduced this in the place which use it, e.g: problem section to explain thread-based pattern, C10K solution to describe the others two pattern)

The C10K point out the thread-base(a.k.a process-per-connect) disavantage which prevent us to effeciently use the compute hardware resources,  especially the processor cycles. One of most interesting solution directions is pointed out in the research is to have less threads/processes to serve more connection. From programming models perspective, I am list them below:
 
### Thread-Based Model(a.k.a thread-per-connection)
    the Apache, requer per thread hit the big problem, CPU is more and more faster than IO, waste CPU time to wait for IO response is not good, and with the request increasing, the thread/process context switch is more and more expensive. also each thread will take memory... all of these bring us to think about an other direction to resolve the problem.
    Diagram of :Apache solution for high perfmance -- request per thread
    
    This model actually is mapped to the IO pattern -- Blocking Pattern

### Reactor Pattern

```
diagram needed here
```

###nonblocking in conjunction with level-triggered readiness notification(readiness selector nofitication,e.g: select, poll) 

both model(2) and mode(3) can be mapped to this pattern, but model(2)  is extremely inefficient because in many cases the application must busy-wait until the data is available or attempt to do other work while the command is perform

nonblocking + multplex well fit in this pattern, because:
(http://davmac.org/davpage/linux/async-io.html)
Non-blocking mode makes it possible to continuously iterate through the interesting file descriptors and check for available input (or check for readiness for output) simply by attempting a read (or write). This technique is called polling and is problematic primarily because it needlessly consumes CPU time - that is, the program never blocks, even when no input or output is possible on any file descriptor. An event notification mechanism is needed to discover when useful reads/writes are possible.

### nonblocking in conjunction with edge-trigerred readiness notification(e.g: epoll and signal notification)
from pure theory perspective, using SIGIO signal nofication to is more efficient than synchornizced-demultiplexer(selector).. but...

1. Signal handler can't do heavy logic
2. Signal can not be queeued. Only handle one more pending, others will be discarded.
  ``` C
    move the c signal handler sample from I/O model section to here
  ```
3. http://davmac.org/davpage/linux/async-io.html

Note also that SIGIO can itself be selected as the notification signal. This allows the assosicated extra data to be retrieved, however, multiple SIGIO signals will not be queued and there is no way to detect if signals have been lost, so it is necessary to treat each SIGIO as an overflow regardless. It's much better to use a real-time signal. If you do, you potentially have an asynchronous event handling scheme which in some cases may be more efficient than using poll() and perhaps even epoll(), which will soon be discussed. 

http://www.linuxprogrammingblog.com/all-about-linux-signals?page=show 
and 
http://www.visolve.com/uploads/resources/squidrtsignal.pdf
and
http://davmac.org/davpage/linux/async-io.html#signals
Event notification with poll
the realtime signal came earlier than epoll, epoll is a more modern api for the polling

advanced linux programming
A signal handler should perform the minimum work necessary to respond to the
signal, and then return control to the main program (or terminate the program). In
most cases, this consists simply of recording the fact that a signal occurred.The main
program then checks periodically whether a signal has occurred and reacts accordingly.

### Proactor Pattern
AIO
    
## Linux Kernel Support

每一大项填加一个bullets 说明

TODO: 每一个具体技术API使用上，注明是POXIS，还是BSD的，还是Linux特有的
GNU libc

Reading the article so far, we already know about the problem and also the possible solution directions. so let's take a closer at linux kernel side, and see whether it is ready to support this

### noblocking
   http://www.wangafu.net/~nickm/libevent-book/01_intro.html
   book: TCPIP socket In C practical guide for programmer
   write a sample here:
   ```
       TODO, sample code
   ```
http://davmac.org/davpage/linux/async-io.html

It is possible to open a file (or device) in "non-blocking" mode by using the O_NONBLOCK option in the call to open. You can also set non-blocking mode on an already open file using the fcntl call. Both of these options are documented in the GNU libc documentation
>However, it is a general weakness of the technique. In general, non-blocking I/O and the event notification mechanisms here will work with sockets and pipes, TTYs, and certain other types of device.
>A more subtle problem with non-blocking I/O is that it generally doesn't work with regular files (this is true on linux, even when files are opened with O_DIRECT; possibly not on other operating systems). That is, opening a regular file in non-blocking mode has no effect for regular files: a read will always actually read some of the file, even if the program blocks in order to do so. In some cases this may not be important, seeing as file I/O is generally fast enough so as to not cause long blocking periods (so long as the file is local and not on a network, or a slow medium). However, it is a general weakness of the technique. In general, non-blocking I/O and the event notification mechanisms here will work with sockets and pipes, TTYs, and certain other types of device.

### Edge-triggered Demultipluxer

     
#### Standard Signal - "SIGIO" noitfication (standard sigal way mentioned in book, TCPIP Sockets In C practical Guide)
what is standard signal
 :
 ``` c
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
  sleep(10);
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
    sleep(3);
  }
  return 0;
}

```

Run the command below
``` bash
for i in {1..10}; do kill -s USR1 <pid>; done
```

``` console
SIGUSR1 was raised 0 times
SIGUSR1 Handler Enter
SIGUSR1 Handler End
SIGUSR1 Handler Enter
SIGUSR1 Handler End
SIGUSR1 was raised 2 times
```
Below is an example to leverage SIGIO signal for readiness notification based on UDP protocol

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
(TCP Socket In C Pratical Guide for programers)
It is important to realize that signals are not queued—a signal is
either pending or it is not. If the same signal is delivered more than once while it is being
handled, the handler is only executed once more after it completes the original execution.

   TODO, if we turn on two port in one thread, and the signal handler is busy with port-1 message handling, can it receive message from port-2 via the signal handler way?
   
   https://github.com/angrave/SystemProgramming/wiki/Signals,-Part-2:-Pending-Signals-and-Signal-Masks
   
   http://stackoverflow.com/questions/5285414/signal-queuing-in-c
   What happens is the following:

First signal received, namely SIGUSR1, handler is called and is running
Second signal received, since handler from nr1 is still running, the signal nr2 gets pending and blocked.
Third signal received, since handler from nr1 is still running, the signal 3 gets discarded.
Fourth, fifth...etc signal of the same type as the signal nr1 are discarded.
Once signal handler is done with signal nr1, it will process signal nr2, and then signal handler will process the SIGUSR2.

Basically, pending signals of the same type are not queued, but discarded. And no, there is no easy way to "burst" send signals that way. One always assumes that there can be several signals that are discarded, and tries to let the handler do the work of cleaning and finding out what to do (such as reaping children, if all children die at the same time).

http://davmac.org/davpage/linux/async-io.html#signals
Of the notification methods, sending a signal would seem at the outset to be the only appropriate choice when large amounts of concurrent I/O are taking place. Although realtime signals could be used, there is a potential for signal buffer overflow which means signals could be lost; furthermore there is no notification at all of such overflow (one would think raising SIGIO in this case would be a good idea, but no, POSIX doesn't specify it, and Glibc doesn't do it). What Glibc does do is set an error on the AIO control block so that if you happen to check, you will see an error. Of course, you never will check because you'll never receive any notification of completion.
To use AIO with signal notifications reliably then, you need to check each and every AIO control block that is associated with a particular signal whenever that signal is received. For realtime signals it means that the signal queue should be drained before this is performed, to avoid redundant checking. It would be possible to use a range of signals and distribute the control blocks to them, which would limit the amount of control blocks to check per signal received; however, it's clear that ultimately this technique is not suitable for large amounts of highly concurrent I/O.

####Realtime Signal Notification - "F_SETSIG" signal

http://www.masterraghu.com/subjects/np/introduction/unix_network_programming_v1.3/ch05lev1sec8.html
That is, by default, Unix signals are not queued. We will see an example of this in the next section. The POSIX real-time standard, 1003.1b, defines some reliable signals that are queued, but we do not use them in this text.

The POSIX specification defines so called real-time signals and Linux supports it(http://www.linuxprogrammingblog.com/all-about-linux-signals?page=show)
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
``` bash
for i in {1..10}; do kill -44 `pgrep rt_signal_test`; done
```

result:

``` console
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

http://bulk.fefe.de/scalable-networking.pdf
http://www.kegel.com/c10k.html#nb.sigio
http://www.freebsd.org/cgi/man.cgi?query=socket&apropos=0&sektion=7&manpath=SuSE+Linux%2Fi386+11.0&format=ascii
http://www.visolve.com/uploads/resources/squidrtsignal.pdf
http://www.lxway.com/4444140926.htm
http://davmac.org/davpage/linux/async-io.html#signals

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
Explain from http://davmac.org/davpage/linux/async-io.html#signals

File descriptors can be set to generate a signal when an I/O readiness event occurs on them - except for those which refer to regular files (which should not be surprising by now). This allows using sleep(), pause() or sigsuspend() to wait for both signals and I/O readiness events, rather than using select()/poll(). The GNU libc documentation has some information on using SIGIO. It tells how you can use the F_SETOWN argument to fcntl() in order to specify which process should recieve the SIGIO signal for a given file descriptor. However, it does not mention that on linux you can also use fcntl() with F_SETSIG to specify an alternative signal, including a realtime signal. Usage is as follows:

   fcntl(fd, F_SETSIG, signum);

... where fd is the file descriptor and signum is the signal number you want to use. Setting signum to 0 restores the default behaviour (send SIGIO). Setting it to non-zero has the effect of causing the specified signal to be queued when an I/O readiness event occurs, if the specified signal is a non-realtime signal which is already pending (? I need to check this - didn't I mean if it is a realtime signal?--难道我不是说如果这是一个realtime信号吗？). If the signal cannot be queued a SIGIO is sent in the traditional manner. 

http://www.visolve.com/uploads/resources/squidrtsignal.pdf
http://www.lxway.com/4444140926.htm

RealTime  signals  have  not  achieved 
widespread  use  because  of 
difficulties  in  use  for  application  writers

https://en.wikipedia.org/wiki/Asynchronous_I/O#Signals_.28interrupts.29
The signal approach, though relatively simple to implement within the OS, brings to the application program the unwelcome baggage associated with writing an operating system's kernel interrupt system. Its worst characteristic is that every blocking (synchronous) system call is potentially interruptible; the programmer must usually incorporate retry code at each call.

####Epoll(edge-trigerred):
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
     
   The synchornized-demultiplexing evolution timeline:
      select --> poll --> SIGIO --> paper --> epoll --> ?(aio combined epoll)
      最后这项需要调研一下
      
### AIO
####Kernel AIO
http://xinsuiyuer.github.io/blog/2014/04/17/posix-aio-libaio-direct-io/
####POSIX AIO
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
case. The aio support for sockets in Linux seems to be shady at best with some
suggesting it is actually using readiness events at kernel level while providing
an asynchronous abstraction on completion events at application level. However
Windows seems to support this first class again via “I/O Completion Ports”.)Poxis AIO actually introduced thread model, not a real AIO supported from kernel level. For Network IO, we only have non-blocking IO. 
     How can we achieve I/O multiplexing without thread-per-connection? You can simply do busy-wait polling for each connection with non-blocking socket operations, but this is too wasteful. What we need to know is which socket becomes ready. So the OS kernel provides a separate channel between your application and the kernel, and this channel notifies when some of your sockets become ready. This is how select()/poll() works, based on the readiness model. (http://people.eecs.berkeley.edu/~sangjin/2012/12/21/epoll-vs-kqueue.html)
     In Linux, for network, we only have multiplux way,  to implement non-blocking and sync IO, OS need provide two things:
     non-blocking socket, with this non-blocking socket, the caller thread can continue do some other things, in order to map the socket response to approparite socket client, a selector is needed here to do the mapping, once there is "readiness" event ready, and caller thread to pick that event up and do the corresponding actions on correct socket. This is IO multipluxer(http://people.eecs.berkeley.edu/~sangjin/2012/12/21/epoll-vs-kqueue.html what is multiplux)
     
http://davmac.org/davpage/linux/async-io.html (why poxis aio is not suited to use)
    
### Level-triggered Demultipluxer
     Explain what is multiplux(diagram file:///home/lizh/materials/studyplan/Nginx/Linux%20IO%20%E5%A4%9A%E8%B7%AF%E5%A4%8D%E7%94%A8%E6%98%AF%E4%BB%80%E4%B9%88%E6%84%8F%E6%80%9D%EF%BC%9F%20-%20Linux%20%E5%BC%80%E5%8F%91%20-%20%E7%9F%A5%E4%B9%8E.html)
     
     select, poll, epoll(http://people.eecs.berkeley.edu/~sangjin/2012/12/21/epoll-vs-kqueue.html)
     
####Select(level-triggered):
     http://amsekharkernel.blogspot.com/2013/05/what-is-epoll-epoll-vs-select-call-and.html
     http://bulk.fefe.de/scalable-networking.pdf
####Poll(level-triggered):
     http://amsekharkernel.blogspot.com/2013/05/what-is-epoll-epoll-vs-select-call-and.html
     http://bulk.fefe.de/scalable-networking.pdf

 ## Event Loop Programming Model(The Bridge of From Reactor Pattern to Proactor pattern) 
 Even we have reactor pattern, it is still hard for programmer to write a good performance server, because this require developer have a deep understand about the thread-safe on the language and lower level OS technology, if not, reactor pattern may have result a regresson server than thread-mode  
 Alought OS kernel did not provide us a easy to do this, smarter programmer never give up the effort to figure out a way  move to Proactor pattern on Reactor pattern, the answer is yes, we can 封装 a thread-mode to adopt the reactor pattern to proactor pattern, the answer is event-loop mode
 
 Please keep in mind, the event-loop mode we mentioned in this article is specific to IO event-loop, not a general event loop, as event loop mode actually is also used widely in the GUI world, e.g: user click mouse on a button, and move a window from one area to an other...
 
 
 event_loop, the result will be callback to caller, it usually come together with a well thread-model implementation
 
 what is event loop(https://seanlin0800.gitbooks.io/async-performance/content/source/ch1/event_loop.html, http://blog.jobbole.com/50138/)

### Tick
explain what is tick in event loop programming model
http://stackoverflow.com/questions/19822668/what-exactly-is-a-node-js-event-loop-tick
 
 ## Event-loop based I/O framework across different programming languages
 ### C programming language:
 Nginx: event mode(file:///home/lizh/materials/studyplan/Nginx/ReadyState4%20%C2%BB%20Blog%20Archive%20%C2%BB%20Nginx,%20the%20non-blocking%20model,%20and%20why%20Apache%20sucks.html)
 event module: http://www.cnblogs.com/fll369/archive/2012/11/29/2794939.html
 http://nginx-book.readthedocs.io/en/latest/chapter_06.html#event-40
 https://www.nginx.com/blog/thread-pools-boost-performance-9x/ (event loop and thread based event loop)
  http://slidedeck.io/donatasm/hacking-an-nginx-module (master and worker has their individual event loop)
  http://www.aosabook.org/en/nginx.html (nginx uses multiplexing and event notifications heavily,Aimed at solving the C10K problem of 10,000 simultaneous connections, nginx was written with a different architecture in mind—one which is much more suitable for nonlinear scalability in both the number of simultaneous connections and requests per second. nginx is event-based, so it does not follow Apache's style of spawning new processes or threads for each web page request. The end result is that even as load increases, memory and CPU usage remain manageable. nginx can now deliver tens of thousands of concurrent connections on a server with typical hardware.)
  https://dzone.com/articles/inside-nginx-how-we-designed
  http://www.xxbar.net/thread-854661-1-1.html(nginx use linux kernel aio for file access if compile with a specific tag)
  http://www.infoq.com/cn/articles/thread-pools-boost-performance-9x
  一些操作系统为读写文件提供了异步接口，NGINX可以使用这样的接口（见AIO指令）。FreeBSD就是个很好的例子。不幸的是，我们不能在Linux上得到相同的福利。虽然Linux为读取文件提供了一种异步接口，但是存在明显的缺点。其中之一是要求文件访问和缓冲要对齐，但NGINX很好地处理了这个问题。但是，另一个缺点更糟糕。异步接口要求文件描述符中要设置O_DIRECT标记，就是说任何对文件的访问都将绕过内存中的缓存，这增加了磁盘的负载。在很多场景中，这都绝对不是最佳选择。
 Libevent
 https://zhuanlan.zhihu.com/p/20315482
 Libev
 Libuv(https://nikhilm.github.io/uvbook/basics.html#event-loops)
 
 ### Java programming language:
 Netty:
 
    Event-Loop(Thread mode) + ChannelPipleline(Extensible event handling framework)
    
    A diagram:
    
              Netty     ---> (eventloop + channelpipleline, async pattern)
              jvm(NIO)  ---> (selector)
              os(epoll) ---> (sync-demultipluxer(selector))
    From 3.x to 4.x, Netty get back to singlethread strategy for the thread-mode, because a good framework should know who important it is to reduce the complexicity for the end user. If each channel(connection) still can switch among different threads, that somewhat take programmer back to the bare reactor pattern, that is a regression from end user experience perspective.
    
    Explain about event-loop in netty , channelpipeline in netty with diagram
    
 ### Node.js:
 
 Diagram about how nodejs works
 (http://www.ruanyifeng.com/blog/2014/10/event-loop.html)
 
 (alternative begin: https://vimeo.com/96425312 Us JavaScript programmers like to use words like, "event-loop", "non-blocking", "callback", "asynchronous", "single-threaded" and "concurrency".

We say things like "don't block the event loop", "make sure your code runs at 60 frames-per-second", "well of course, it won't work, that function is an asynchronous callback!"

If you're anything like me, you nod and agree, as if it's all obvious, even though you don't actually know what the words mean; and yet, finding good explanations of how JavaScript actually _works_ isn't all that easy, so let's learn!

With some handy visualisations, and fun hacks, let's get an intuitive understanding of what happens when JavaScript runs. Beginner or veteran, I'm sure you'll learn something!)
 ## Weak point in event-loop
For the thread model, e.g: node.js, in the main loop, if cpu-intensive job performance, the server will lost response. To sovle this, the straightforward way is to make the cpu-intensive work running in a separate thread/process(different than the main event-loop process). 
Nginx realize this problem, in 1.7, it introduce multple thread model in their even model
Netty's event-loop can add customized strategy ??
 ## Is event-loop model the ONLY choice?
Of course not, essentially, the event loop model is on the way of using less threads to service more requests/connections. In an other hand, erlang and golang are resolving the problem by making a lightweight "green-thread" to archive the same goal. and also do this very well in their direction.
 http://demo.netfoucs.com/jiao_fuyou/article/details/36010691
    
    
## Wrap up

IO Pattern:         Blocking and Sync ---> non-blocking Sync --> non-blocking async
    OS(kernel):                            non-blocking socket           AIO
                                              multipulex(epoll)
Programming Model:                             Java NIO      --(event-loop)---->   Netty
                                                 C-------------event-module--------> Nginx
                                                 JS             (libuv)         ---> node.js
                                                 
                                                 
             IO Pattern           BLocking and Sync -->(kernel) -->   NIO      Async IO
             
evolution timeline:
             
## References
[1] http://www.ibm.com/developerworks/linux/library/l-async/

[2] TCP Socket In C Pratical Guide for programers

[3] Unix Network Programming

[4] Advanced Linux Programming

[5] TCPIP Sockets In C Pratical Guide For Programmers 2nd edition

[6] http://davmac.org/davpage/linux/async-io.html

[7] http://gngrwzrd.com/libgwrl/pod.html#reactor_pattern

[8] https://nikhilm.github.io/uvbook/basics.html#event-loops

[9] https://chamibuddhika.wordpress.com/2012/08/11/io-demystified/

[10] http://people.eecs.berkeley.edu/~sangjin/2012/12/21/epoll-vs-kqueue.html

[11] http://amsekharkernel.blogspot.com/2013/05/what-is-epoll-epoll-vs-select-call-and.html

[12] https://seanlin0800.gitbooks.io/async-performance/content/source/ch1/event_loop.html

[13] https://nikhilm.github.io/uvbook/basics.html#event-loops

[14] http://man7.org/linux/man-pages/man7/aio.7.html

[15] https://www.fsl.cs.sunysb.edu/~vass/linux-aio.txt

[16] file:///home/lizh/materials/studyplan/Netty/Netty%E7%B3%BB%E5%88%97%E4%B9%8BNetty%E7%BA%BF%E7%A8%8B%E6%A8%A1%E5%9E%8B.html

[17] http://www.wangafu.net/~nickm/libevent-book/01_intro.html

[18] http://xinsuiyuer.github.io/blog/2014/04/17/posix-aio-libaio-direct-io/

[19] https://github.com/angrave/SystemProgramming/wiki/Signals,-Part-2:-Pending-Signals-and-Signal-Masks

[20] http://www.makelinux.net/ldd3/chp-6-sect-4

[21] https://en.wikipedia.org/wiki/Asynchronous_I/O#Signals_.28interrupts.29

[22] http://lse.sourceforge.net/io/aio.html

[23] http://www.bullopensource.org/posix/

[24] http://www.ruanyifeng.com/blog/2014/10/event-loop.html

[25] http://www.ccvita.com/515.html

[26] file:///home/lizh/materials/studyplan/Nginx/Linux%20IO%20%E5%A4%9A%E8%B7%AF%E5%A4%8D%E7%94%A8%E6%98%AF%E4%BB%80%E4%B9%88%E6%84%8F%E6%80%9D%EF%BC%9F%20-%20Linux%20%E5%BC%80%E5%8F%91%20-%20%E7%9F%A5%E4%B9%8E.html

[27] file:///home/lizh/materials/studyplan/Nginx/%E6%9E%B6%E6%9E%84%E5%B8%88%E5%AE%9E%E8%B7%B5%E6%97%A5%EF%BD%9C%E4%BB%8EC10K%E5%88%B0C10M%E9%AB%98%E6%80%A7%E8%83%BD%E7%BD%91%E7%BB%9C%E7%9A%84%E6%8E%A2%E7%B4%A2%E4%B8%8E%E5%AE%9E%E8%B7%B5%C2%A0%20_%20%E4%B8%83%E7%89%9B%E4%BA%91%E5%AD%98%E5%82%A8.html

[28] http://www.linuxprogrammingblog.com/all-about-linux-signals?page=show

[29] http://www.visolve.com/uploads/resources/squidrtsignal.pdf

[30] http://cs-pub.bu.edu/fac/richwest/cs591_w1/notes/wk3_pt2.PDF
                              
[31] http://w0z1y.blog.163.com/blog/static/116392700201201814549536/

[32] http://linux.die.net/man/7/signal

[33] http://www.linuxjournal.com/article/6483?page=0,1

[34] http://www.lxway.com/4444140926.htm (real-time signal based selector)

[35] http://blog.csdn.net/ykdsea/article/details/46969677

[36] http://blog.chinaunix.net/uid-24774106-id-4061386.html

[37] http://blog.chinaunix.net/uid-24774106-id-4064447.html

[38] http://www.kegel.com/c10k.html

[39] http://bulk.fefe.de/scalable-networking.pdf

[40] http://www.freebsd.org/cgi/man.cgi?query=socket&apropos=0&sektion=7&manpath=SuSE+Linux%2Fi386+11.0&format=ascii

[41] http://www.cnblogs.com/liyux/p/5603826.html   

[42] http://www.masterraghu.com/subjects/np/introduction/unix_network_programming_v1.3/ch05lev1sec8.html
