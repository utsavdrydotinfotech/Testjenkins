echo "Start!"
echo "good"
p=`cat test.txt`
echo $p
	if [[ $p == dist ]]
    	    then
			echo "eveything is good" > good.txt
                	ls
	else
			echo "ok did't do anything " > free.txt
	fi

