/*
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
*/
package quarks.topology.services;

import java.util.Set;

import com.google.gson.JsonObject;

import quarks.execution.Submitter;
import quarks.function.BiConsumer;
import quarks.topology.Topology;
import quarks.topology.mbeans.ApplicationServiceMXBean;

/**
 * Application registration service.
 * A service that allows registration of applications and
 * the ability to submit them through a control MBean.
 *
 * @see ApplicationServiceMXBean
 */
public interface ApplicationService {
    
	/**
	 * Default alias a service registers its control MBean as.
	 * Value is {@value}.
	 */
    String ALIAS = "quarks";
    
    /**
     * Prefix ({@value}) reserved for system application names.
     */
    String SYSTEM_APP_PREFIX = "quarks";
    
    /**
     * Add a topology that can be started though a control mbean.
     * Any registration replaces any existing application with the same name.
     * <BR>
     * When a {@link ApplicationServiceMXBean#submit(String, String) submit}
     * is invoked {@code builder.accept(topology, config)} is called passing:
     * <UL>
     * <LI>
     * {@code topology} - An empty topology with the name {@code applicationName}.
     * </LI>
     * <LI>
     * {@code config} - JSON submission configuration from
     * {@link ApplicationServiceMXBean#submit(String, String) submit}.
     * </LI>
     * </UL>
     * Once {@code builder.accept(topology, config)} returns it is submitted
     * to the {@link Submitter} associated with the implementation of this service.
     * <P>
     * Application names starting with {@link #SYSTEM_APP_PREFIX quarks} are reserved
     * for system applications.
     * </P>
     * 
     * @param applicationName Application name to register.
     * @param builder How to build the topology for this application.
     * 
     * @see ApplicationServiceMXBean
     */
    void registerTopology(String applicationName, BiConsumer<Topology, JsonObject> builder);
    
    /**
     * Register a jar file containing new applications.
     * Any service provider within the jar of type {@link TopologyBuilder}
     * will be {@link #registerTopology(String, BiConsumer) registered} as
     * a topology.
     * 
     * The jar cannot have any new dependencies, its classpath will
     * be the classpath of this service.
     * 
     * @param jarURL URL of Jar containing new applications.
     * @param jsonConfig Configuration information, currently unused.
     */
    void registerJar(String jarURL, String jsonConfig) throws Exception;
    
    /**
     * Returns the names of applications registered with this service.
     * 
     * @return the names of applications registered with this service.
     */
    Set<String> getApplicationNames();
}
